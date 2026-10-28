// Default shell block: users own this composition; native capabilities stay in the package.
import { connectDesktopAtlas } from "@alwith/module-desktop-shell"
import { type AtlasController } from "@nyssance/atlas/dom"
import { Atlas, AtlasNavigation, AtlasRegion } from "@nyssance/atlas/react"
import { type ReactNode, useEffect, useState } from "react"

export function Shell({ leading, navigation, children }: { leading: ReactNode; navigation: ReactNode; children: ReactNode }) {
  const [atlas, setAtlas] = useState<AtlasController | null>(null)
  useEffect(() => atlas ? connectDesktopAtlas(atlas) : undefined, [atlas])
  return (
    <Atlas
      className="desktop-shell"
      data-atlas-layout="navigation"
      options={{ initialRegion: "workspace", insetTop: 0, flickMinIndex: 0, manageInert: false }}
      onReady={setAtlas}
      aria-label="Workspace"
    >
      <AtlasRegion id="leading" data-atlas-leading className="h-full">{leading}</AtlasRegion>
      <AtlasNavigation className="h-full">
        <div className="desktop-shell-navigation">{navigation}</div>
      </AtlasNavigation>
      <AtlasRegion id="workspace" className="desktop-shell-workspace">{children}</AtlasRegion>
    </Atlas>
  )
}
