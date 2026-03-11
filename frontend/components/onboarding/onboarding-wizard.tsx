"use client";

import { useState } from "react";
import { useAuth } from "../../context/auth-context";
import { useToast } from "../ui/toast";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { IconKey, IconSearch, IconFileText, IconCheck, IconChevronRight } from "../ui/icons";

const STEPS = [
  { id: "key", label: "Generate API Key", icon: IconKey, description: "Create an API key to access property data" },
  { id: "search", label: "Search a Property", icon: IconSearch, description: "Find your first property by title number" },
  { id: "report", label: "Generate a Report", icon: IconFileText, description: "Create a property intelligence report" },
];

type OnboardingProps = {
  onComplete: () => void;
  onSkip: () => void;
};

export function OnboardingWizard({ onComplete, onSkip }: OnboardingProps) {
  const { apiKey, generateApiKey } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(apiKey ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [keyGenerated, setKeyGenerated] = useState(!!apiKey);

  const onGenerateKey = async () => {
    setLoading(true);
    const result = await generateApiKey();
    setLoading(false);
    if (result.ok) {
      setKeyGenerated(true);
      toast("API key generated!", "success");
      setCurrentStep(1);
    } else {
      toast(result.error || "Failed to generate key.", "error");
    }
  };

  const goToProperties = () => {
    setCurrentStep(2);
    // Mark onboarding complete — user can explore on their own
    markComplete();
  };

  const markComplete = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("milki_onboarded", "true");
    }
    onComplete();
  };

  return (
    <Card padding="lg" className="animate-slideUp">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2>Welcome to Milki</h2>
          <p className="text-sm text-secondary mt-1">Let&apos;s get you set up in 3 quick steps.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { markComplete(); onSkip(); }}>
          Skip setup
        </Button>
      </div>

      {/* Progress steps */}
      <div className="onboarding-steps mb-6">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isComplete = i < currentStep || (i === 0 && keyGenerated);
          const isCurrent = i === currentStep;

          return (
            <div key={step.id} className={`onboarding-step ${isComplete ? "step-complete" : ""} ${isCurrent ? "step-current" : ""}`}>
              <div className="onboarding-step-indicator">
                {isComplete ? <IconCheck size={14} /> : <span>{i + 1}</span>}
              </div>
              <div className="onboarding-step-content">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{step.label}</span>
                  {isComplete && <Badge variant="success">Done</Badge>}
                </div>
                <p className="text-xs text-tertiary">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="onboarding-action">
        {currentStep === 0 && !keyGenerated && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-secondary">
              An API key lets you search properties, verify ownership, and generate reports.
            </p>
            <Button onClick={onGenerateKey} loading={loading} icon={<IconKey size={16} />}>
              Generate My API Key
            </Button>
          </div>
        )}

        {currentStep === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-secondary">
              Head to the Properties page to search for your first property using a title number.
            </p>
            <Button onClick={goToProperties} icon={<IconChevronRight size={16} />}>
              Go to Properties
            </Button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-secondary">
              You&apos;re all set! Generate reports from the Properties page once you find a property.
            </p>
            <Button onClick={markComplete}>
              Start Exploring
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Check if user has completed onboarding */
export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("milki_onboarded") === "true";
}
