Shader "Custom/DoubleSidedPBRCloth_NoDiffuse" {
    Properties {
        _FrontColor ("Front Color", Color) = (1,1,1,1) // 正面颜色：设为纯白
        _BackColor ("Back Color", Color) = (0.95, 0.95, 0.95, 1) // 背面颜色：可以稍微暗一点点方便区分
        
        [Header(PBR Textures)]
        _BumpMap ("Normal Map", 2D) = "bump" {}
        _RoughnessMap ("Roughness Map", 2D) = "white" {}
        _MetallicMap ("Metallic Map", 2D) = "black" {}
        
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
        sampler2D _RoughnessMap;
        sampler2D _MetallicMap;

        // 因为没有 _MainTex 了，我们用法线的 UV 作为基础 UV
        struct Input {
            float2 uv_BumpMap; 
            fixed vface : VFACE; 
        };

        fixed4 _FrontColor;
        fixed4 _BackColor;
        float4 _Tiling;

        void surf (Input IN, inout SurfaceOutputStandard o) {
            float2 uv = IN.uv_BumpMap * _Tiling.xy;

            // 1. 直接使用面板设定的颜色，完全不需要贴图相乘
            o.Albedo = IN.vface > 0 ? _FrontColor.rgb : _BackColor.rgb;

            // 2. 解析法线贴图保留织物质感
            fixed3 normal = UnpackNormal(tex2D(_BumpMap, uv));
            if (IN.vface < 0) {
                normal.z = -normal.z;
            }
            o.Normal = normal;

            // 3. 读取并转换粗糙度与金属度
            fixed roughness = tex2D(_RoughnessMap, uv).r;
            o.Smoothness = 1.0 - roughness;
            o.Metallic = 0.0;

            o.Alpha = 1.0;
        }
        ENDCG
    }
    FallBack "Diffuse"
}