import { cn } from '@/shared/lib/utils'

// Low-specificity defaults let OTP and password controls own their sizing.
export function AuthCard({ children, busy }) {
  return (
    <section
      data-ui="auth-card"
      aria-busy={busy}
      className={cn(
        'w-full max-w-120 place-self-center rounded-panel border border-border bg-white p-8 max-[761px]:p-6',
        '[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:leading-8 [&_h1]:text-navy',
        '[:where(&_p)]:mt-4 [:where(&_p)]:text-sm [:where(&_p)]:leading-6 [:where(&_p)]:text-muted-foreground [:where(&_p)]:wrap-anywhere',
        '[:where(&_form)]:mt-6 [:where(&_form)]:grid [:where(&_form)]:gap-6',
        '[&_label]:grid [&_label]:gap-2 [&_label]:text-[0.8125rem] [&_label]:font-medium [&_label]:leading-5',
        '[:where(&_input)]:min-h-11 [:where(&_input)]:min-w-0 [:where(&_input)]:w-full [:where(&_input)]:rounded-control [:where(&_input)]:border [:where(&_input)]:border-strong-border [:where(&_input)]:bg-white [:where(&_input)]:px-3 [:where(&_input)]:py-2 [:where(&_input)]:text-sm [:where(&_input)]:leading-6',
        '[&_input[readonly]]:bg-background [&_input[readonly]]:text-muted-foreground',
        '[&_dl]:my-6 [&_dl]:wrap-anywhere [&_dt]:mt-4 [&_dt]:text-xs [&_dt]:text-muted-foreground',
        "[&_[role='alert']]:text-danger",
      )}
    >
      {children}
    </section>
  )
}
