import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary pointer-coarse:min-h-11 forced-colors:border forced-colors:border-[ButtonText] disabled:cursor-not-allowed',
  {
    variants: {
      size: {
        sm: 'min-h-8 rounded-card px-3 py-1 text-[0.8125rem] font-normal pointer-coarse:min-h-11',
        icon: 'size-11 min-h-11 shrink-0 p-0',
      },
      variant: {
        default:
          'bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 disabled:pointer-events-none disabled:opacity-50',
        outline:
          'border border-strong-border bg-white text-navy hover:bg-selected disabled:opacity-50',
        ghost: 'bg-transparent text-navy hover:bg-selected disabled:opacity-50',
        link: 'min-h-0 rounded-none bg-transparent px-0 py-0 text-primary hover:underline disabled:opacity-50 pointer-coarse:min-h-11',
        auth: 'min-h-11 w-full bg-primary py-3 leading-5 text-white hover:enabled:opacity-90 disabled:bg-disabled disabled:text-muted-foreground',
        authLink:
          'min-h-11 rounded-none bg-transparent px-0 py-0 text-[0.8125rem] font-normal leading-5 text-primary hover:underline disabled:opacity-50',
        activityHeader:
          'min-h-10 rounded-card border border-strong-border bg-white px-4 py-[9px] text-[0.8125rem] font-semibold leading-5 text-navy hover:bg-selected disabled:opacity-50 pointer-coarse:min-h-11',
        danger:
          'bg-danger text-white hover:opacity-90 active:opacity-80 disabled:pointer-events-none disabled:opacity-50',
        unstyled:
          'min-h-0 rounded-none bg-transparent px-0 py-0 font-normal text-inherit',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

// Shared by native command buttons and download/navigation links. Typography
// stays with the containing control (including Button's default variant).
export const businessActionClassName =
  'inline-flex gap-2 items-center min-h-11 py-[10px] px-[14px] rounded-control bg-primary text-white no-underline'
