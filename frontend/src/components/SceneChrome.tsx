import { TopStatusBar } from './TopStatusBar'
import { NavTabs } from './NavTabs'
import { TaskScroll } from './TaskScroll'
import { BackButton } from './BackButton'
import { useNav, type SceneId } from '../app/nav'

/** Standard scene chrome: left task scroll, top status bar, nav tabs, back button. */
export function SceneChrome({
  back = 'map',
  tabs = true,
  task = true,
  status = true,
}: {
  back?: SceneId
  tabs?: boolean
  task?: boolean
  status?: boolean
}) {
  const { go } = useNav()
  return (
    <>
      {task && <TaskScroll x={48} y={81} />}
      {status && <TopStatusBar />}
      {tabs && <NavTabs />}
      <BackButton onClick={() => go(back)} />
    </>
  )
}
