import type { FC } from 'react'
import { GatekeeperIcon } from './GatekeeperIcon'

function connectionLogo(vendorId: string): FC<{ size?: number }> {
  return function NuevaunoConnectionLogo({ size = 20 }) {
    return <GatekeeperIcon vendorId={vendorId} size={size} className="h-auto w-auto bg-transparent" />
  }
}

export const SlackLogo = connectionLogo('slack')
export const DiscordLogo = connectionLogo('discord')
export const JiraLogo = connectionLogo('jira')
export const GoogleLogo = connectionLogo('google')
export const GitHubLogo = connectionLogo('github')
export const NotionLogo = connectionLogo('notion')
export const LinearLogo = connectionLogo('linear')
export const FigmaLogo = connectionLogo('figma')

export const logoComponents: Record<string, FC<{ size?: number }>> = {
  slack: SlackLogo,
  discord: DiscordLogo,
  jira: JiraLogo,
  google: GoogleLogo,
  github: GitHubLogo,
  notion: NotionLogo,
  linear: LinearLogo,
  figma: FigmaLogo,
}
