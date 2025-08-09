import { twJoin, twMerge, type ClassNameValue } from "tailwind-merge"

export function cn(...inputs: ClassNameValue[]) {
  return twMerge(twJoin(inputs))
}
