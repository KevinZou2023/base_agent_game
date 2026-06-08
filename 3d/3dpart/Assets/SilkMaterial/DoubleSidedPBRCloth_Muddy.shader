Shader "Custom/DoubleSidedPBRCloth_Muddy" {
    Properties {
        _FrontColor ("Front Color (Mud)", Color) = (0.2, 0.18, 0.15, 1) // 污泥的深色
        _BackColor ("Back Color (Silk)", Color) = (0.6, 0.3, 0.1, 1)   // 薯莨底色
        
        // 【核心新增】：专属的“泥巴湿润度”滑块
        _Wetness ("Mud Wetness (Front Smoothness)", Range(0, 1)) = 0.85 
        _BackSmoothness ("Silk Smoothness (Back)", Range(0, 1)) = 0.3
        
        [Header(PBR Textures)]
        _BumpMap ("Normal Map", 2D) = "bump" {}
        
        [Header(Texture Tiling)]
        _Tiling ("Tiling", Vector) = (1, 1, 0, 0)
    }
    
    SubShader {
        Tags { "RenderType"="Opaque" }
        LOD 200
        Cull Off 

        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0

        sampler2D _BumpMap;

        struct Input {
            float2 uv_BumpMap; 
            fixed vface : VFACE; 
        };

        fixed4 _FrontColor;
        fixed4 _BackColor;
        float _Wetness;
        float _BackSmoothness;
        float4 _Tiling;

        void surf (Input IN, inout SurfaceOutputStandard o) {
            float2 uv = IN.uv_BumpMap * _Tiling.xy;

            // 1. 正反面颜色独立
            o.Albedo = IN.vface > 0 ? _FrontColor.rgb : _BackColor.rgb;

            // 2. 法线处理：泥巴覆盖了纹理，正面法线减弱；背面保持正常
            fixed3 normal = UnpackNormal(tex2D(_BumpMap, uv));
            if (IN.vface > 0) {
                normal.xy *= 0.3; // 把正面的丝绸凹凸感削弱 70%，模拟被泥糊住
            } else {
                normal.z = -normal.z; // 背面正常反转
            }
            o.Normal = normal;

            // 3. 【核心水光感】：正面读取湿润度滑块，背面读取干爽丝绸滑块
            o.Smoothness = IN.vface > 0 ? _Wetness : _BackSmoothness;
            
            // 彻底的非金属，强制为 0
            o.Metallic = 0.0; 
            o.Alpha = 1.0;
        }
        ENDCG
    }
    FallBack "Diffuse"
}