import { useEffect, useState } from 'react'
import {
  defaultUrlTransform,
  type UrlTransform,
  type LinkSafetyConfig,
  type LinkSafetyModalProps,
} from 'streamdown'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'

/** Old conversations still contain these retired source URLs. Keep their link destinations useful. */
export const chatUrlTransform: UrlTransform = (url, key, node) => {
  const safe = defaultUrlTransform(url, key, node) ?? ''
  if (key === 'href') {
    try {
      const protocol = new URL(safe, 'https://run2-pohang-demo.vercel.app')
        .protocol
      if (!['https:', 'http:', 'mailto:', 'tel:'].includes(protocol)) return ''
    } catch {
      return ''
    }
  }
  try {
    const parsed = new URL(safe)
    if (
      parsed.hostname === 'oceang.kr' ||
      parsed.hostname === 'www.oceang.kr'
    ) {
      const replacements: Record<string, string> = {
        '/ko/cafe/food/?i=293':
          'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=5ca71de0-c2ae-43c0-b69d-ef840d2d9712',
        '/ko/cafe/food/?i=237': 'https://place.map.kakao.com/9570020',
        '/ko/cafe/cafe/?i=369': 'https://place.map.kakao.com/2130999132',
      }
      return (
        replacements[`${parsed.pathname}?i=${parsed.searchParams.get('i')}`] ??
        safe
      )
    }
  } catch {
    /* Relative links keep Streamdown's normal protocol sanitization. */
  }
  return safe
}

export function ExternalLinkDialog({
  url,
  isOpen,
  onClose,
  onConfirm,
}: LinkSafetyModalProps) {
  const [copy, setCopy] = useState<'idle' | 'done' | 'error'>('idle')
  useEffect(() => {
    setCopy('idle')
  }, [url, isOpen])
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="z-[60] max-h-[85dvh] overflow-y-auto"
      >
        <DialogTitle>외부 사이트로 이동</DialogTitle>
        <DialogDescription>아래 주소를 새 창에서 열어요.</DialogDescription>
        <p className="select-text break-all rounded-lg bg-muted p-3 text-xs">
          {url}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">닫기</Button>
          </DialogClose>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                setCopy('done')
              } catch {
                setCopy('error')
              }
            }}
          >
            {copy === 'done' ? '복사했어요' : '링크 복사'}
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            링크 열기
          </Button>
        </div>
        {copy === 'error' && (
          <p role="status" className="text-xs">
            복사하지 못했어요. 위 주소를 길게 눌러 복사해 주세요.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Radix owns both this dialog and the chat sheet, so focus and pointer events
// remain inside the topmost overlay. Streamdown's body portal was inert behind the sheet.
export const chatLinkSafety: LinkSafetyConfig = {
  enabled: true,
  renderModal: (props) => <ExternalLinkDialog {...props} />,
}
