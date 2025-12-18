import React from "react";
import { render, screen } from "@testing-library/react";
import { QualityGauge } from "../client/src/components/ui/quality-gauge";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock Tooltip components since they require DOM measurements
jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children, asChild, ...props }: any) => {
    // If asChild is true, we clone the child and pass props
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, props);
    }
    return <button {...props}>{children}</button>;
  },
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}));

// Mock Gauge icon
jest.mock("lucide-react", () => ({
  Gauge: () => <svg data-testid="gauge-icon" />,
}));

describe("QualityGauge", () => {
  it("renders with correct accessibility attributes", () => {
    render(
        <QualityGauge score={95} level="green" explanation="Excellent" />
    );

    // Find the trigger element (the div with class)
    // We look for text "95%" which is inside the span inside the div
    const scoreElement = screen.getByText("95%");
    const container = scoreElement.parentElement;

    expect(container).toHaveAttribute("tabIndex", "0");
    expect(container).toHaveAttribute("role", "status");
    expect(container).toHaveAttribute("aria-label", "Link-Qualität: 95%. Excellent");
  });
});
