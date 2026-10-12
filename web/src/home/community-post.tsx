import type { SyntheticEvent } from 'react'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { ProgressiveBlur } from '#/app/progressive-blur'
import type { CommunityPost } from '#/core/community'

const fallback = '/images/guryongpo-harbor.jpg'
const onImageError = (e: SyntheticEvent<HTMLImageElement>) => {
  if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback
}

/** What a post says about itself, already in the reader's language. */
export type PostText = {
  title: string
  date: string
  alt: string
  /** The demo-photo disclosure, when the photo is not a real one. */
  note?: string
}

/** A thumbnail-first tile; the title and date rise over a blur on hover. */
export const PostTile = ({
  post,
  text,
  shape,
  onOpen,
}: {
  post: CommunityPost
  text: PostText
  shape: string
  onOpen: () => void
}) => (
  <Card className="gap-0 overflow-hidden py-0">
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full cursor-pointer text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <img
        src={post.image}
        alt={text.alt}
        loading="lazy"
        width="1200"
        height="800"
        onError={onImageError}
        className={`w-full bg-muted/30 object-cover ${shape}`}
      />
      {/* On hover or focus; always on touch screens, where nothing hovers. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
        <ProgressiveBlur />
        <div className="absolute inset-0 bg-linear-to-t from-black/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5 text-white">
          <p className="line-clamp-2 text-sm font-medium">{text.title}</p>
          <p className="text-xs text-white/80">{text.date}</p>
        </div>
      </div>
    </button>
  </Card>
)

const Body = ({ post, text }: { post: CommunityPost; text: PostText }) => (
  <div className="flex flex-col gap-3">
    <img
      src={post.image}
      alt={text.alt}
      width="1200"
      height="800"
      onError={onImageError}
      className="max-h-[55dvh] w-full rounded-xl bg-muted/30 object-contain"
    />
    {post.caption && (
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {post.caption}
      </p>
    )}
    {text.note && <p className="text-xs text-muted-foreground">{text.note}</p>}
  </div>
)

/** The whole post: a bottom drawer on phones, a dialog on wider screens. */
export const PostDetail = ({
  post,
  text,
  onClose,
}: {
  post: CommunityPost | null
  text: PostText | null
  onClose: () => void
}) => {
  const mobile = useIsMobile()
  const open = post !== null && text !== null
  const change = (next: boolean) => {
    if (!next) onClose()
  }
  const meta = post && text ? `${post.author} · ${text.date}` : ''
  if (mobile)
    return (
      <Drawer open={open} onOpenChange={change}>
        <DrawerContent className="max-h-[92dvh]">
          {post && text && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle>{text.title}</DrawerTitle>
                <DrawerDescription>{meta}</DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6">
                <Body post={post} text={text} />
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    )
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {post && text && (
          <>
            <DialogHeader>
              <DialogTitle>{text.title}</DialogTitle>
              <DialogDescription>{meta}</DialogDescription>
            </DialogHeader>
            <Body post={post} text={text} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
