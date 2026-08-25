import type { CSSProperties, ComponentType, HTMLAttributes } from 'react'
import NuevaunoIcon, { type NuevaunoIconName } from './NuevaunoIcon'

export type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, 'color'> & {
  size?: number | string
  weight?: string
  color?: string
  mirrored?: boolean
}

export type Icon = ComponentType<IconProps>

function glyph(name: NuevaunoIconName, rotation = 0): Icon {
  function NuevaunoGlyph({
    size = 16,
    weight: _weight,
    color,
    mirrored = false,
    className = '',
    style,
    ...props
  }: IconProps) {
    const pixels = typeof size === 'number' ? size : Number.parseFloat(size) || 16
    const transform = [rotation ? `rotate(${rotation}deg)` : '', mirrored ? 'scaleX(-1)' : '']
      .filter(Boolean)
      .join(' ')
    const mergedStyle: CSSProperties = { color, transform: transform || undefined, ...style }

    return (
      <span
        {...props}
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        style={{ width: pixels, height: pixels, ...mergedStyle }}
      >
        <NuevaunoIcon name={name} size={pixels} />
      </span>
    )
  }
  NuevaunoGlyph.displayName = `NuevaunoGlyph(${name})`
  return NuevaunoGlyph
}

export const AppWindow = glyph('app')
export const ArrowClockwise = glyph('refresh')
export const ArrowDown = glyph('forward', 90)
export const ArrowLeft = glyph('back')
export const ArrowRight = glyph('forward')
export const ArrowSquareOut = glyph('external_link')
export const ArrowUUpLeft = glyph('undo')
export const ArrowUp = glyph('forward', -90)
export const ArrowUpRight = glyph('external_link')
export const ArrowsClockwise = glyph('refresh')
export const ArrowsOutSimple = glyph('expand')
export const Blueprint = glyph('project')
export const BookOpen = glyph('knowledge')
export const Brain = glyph('brain')
export const Buildings = glyph('users')
export const CalendarBlank = glyph('automation')
export const Camera = glyph('camera')
export const CaretDown = glyph('next', 90)
export const CaretLeft = glyph('previous')
export const CaretRight = glyph('next')
export const ChartBar = glyph('chart')
export const Check = glyph('confirm')
export const CheckCircle = glyph('success')
export const Circle = glyph('info')
export const Clock = glyph('automation')
export const CloudCheck = glyph('cloud')
export const CloudWarning = glyph('warning')
export const Clipboard = glyph('copy')
export const Code = glyph('code')
export const Columns = glyph('columns')
export const Compass = glyph('compass')
export const Copy = glyph('copy')
export const Cube = glyph('app')
export const Database = glyph('database')
export const DotsThree = glyph('more_options')
export const DotsThreeVertical = glyph('more_options', 90)
export const DownloadSimple = glyph('download')
export const Eye = glyph('view')
export const EyeSlash = glyph('view')
export const File = glyph('documentos')
export const FileCode = glyph('code')
export const FilePlus = glyph('add')
export const FileText = glyph('documentos')
export const Folder = glyph('project')
export const FolderPlus = glyph('add')
export const FlowArrow = glyph('automation')
export const Globe = glyph('globe')
export const GitBranch = glyph('automation')
export const GridFour = glyph('grid')
export const GridNine = glyph('grid')
export const ImageSquare = glyph('image')
export const Image = glyph('image')
export const Info = glyph('info')
export const Kanban = glyph('project')
export const Key = glyph('key')
export const Lightning = glyph('automation')
export const Link = glyph('link')
export const LinkSimple = glyph('link')
export const List = glyph('list')
export const ListChecks = glyph('list')
export const Lock = glyph('lock')
export const MagnifyingGlass = glyph('search')
export const Notebook = glyph('knowledge')
export const Pencil = glyph('edit')
export const PencilSimple = glyph('edit')
export const Plug = glyph('connections')
export const Plugs = glyph('connections')
export const PlugsConnected = glyph('connections')
export const Plus = glyph('add')
export const Presentation = glyph('website_slides')
export const Pulse = glyph('notifications')
export const Question = glyph('info')
export const Radio = glyph('select_model')
export const Robot = glyph('robot')
export const Rocket = glyph('automation')
export const Rows = glyph('rows')
export const ShareNetwork = glyph('share')
export const Shield = glyph('shield')
export const ShieldCheck = glyph('shield')
export const ShieldWarning = glyph('warning')
export const Sparkle = glyph('favorite')
export const Stack = glyph('stack')
export const Star = glyph('favorite')
export const Swap = glyph('swap')
export const Table = glyph('hoja_calculo')
export const Terminal = glyph('terminal')
export const Trash = glyph('delete')
export const UploadSimple = glyph('upload')
export const User = glyph('user')
export const UserCircle = glyph('user')
export const UserPlus = glyph('user_add')
export const UsersThree = glyph('users')
export const Warning = glyph('warning')
export const WarningCircle = glyph('warning')
export const X = glyph('close')
