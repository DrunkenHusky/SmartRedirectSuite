import * as React from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, ButtonProps } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CopyButtonProps extends ButtonProps {
  value: string
  label?: string
  successLabel?: string
}

export function CopyButton({
  value,
  className,
  variant = "ghost",
  size = "icon",
  label = "Kopieren",
  successLabel = "Kopiert!",
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false)

  React.useEffect(() => {
    if (!hasCopied) return

    const timeout = setTimeout(() => {
      setHasCopied(false)
    }, 2000)

    return () => clearTimeout(timeout)
  }, [hasCopied])

  const onCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(value)
    setHasCopied(true)
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            className={cn("h-6 w-6 relative flex-shrink-0", className)}
            onClick={onCopy}
            aria-label={hasCopied ? successLabel : label}
            {...props}
          >
            <span className="sr-only">{hasCopied ? successLabel : label}</span>
            {hasCopied ? (
              <Check className="h-3 w-3 text-green-500 transition-all scale-100" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground transition-all scale-100" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{hasCopied ? successLabel : label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
