/**
 * JGA Domain Components
 * 
 * Components specific to JGA business logic (projects, contractors, compliance, etc.)
 */

import React from "react";
import { Card, Badge, Button } from "./index";

// ============================================================================
// Project Status Badge
// ============================================================================

interface ProjectStatusBadgeProps {
  status: string;
}

export const ProjectStatusBadge: React.FC<ProjectStatusBadgeProps> = ({
  status,
}) => {
  const statusColors: Record<string, "success" | "warning" | "error" | "info"> =
    {
      intake: "info",
      quoted: "info",
      "contract-pending": "warning",
      "contract-signed": "warning",
      active: "success",
      "in-production": "success",
      review: "info",
      completed: "success",
      cancelled: "error",
    };

  const statusLabels: Record<string, string> = {
    intake: "Intake",
    quoted: "Quoted",
    "contract-pending": "Contract Pending",
    "contract-signed": "Contract Signed",
    active: "Active",
    "in-production": "In Production",
    review: "Review",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <Badge variant={statusColors[status] || "neutral"}>
      {statusLabels[status] || status}
    </Badge>
  );
};

// ============================================================================
// Project Card Component
// ============================================================================

interface Project {
  id: string;
  name: string;
  customer_name?: string;
  status: string;
  estimated_value: number;
  start_date?: string;
  target_completion_date?: string;
  progress?: number;
}

interface ProjectCardProps {
  project: Project;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onView,
  onEdit,
}) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-semibold">{project.name}</h3>
          <p className="text-sm text-gray-600">{project.customer_name}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <div className="my-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Value:</span>
          <span className="font-semibold">${project.estimated_value.toLocaleString()}</span>
        </div>

        {project.progress && (
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Progress:</span>
              <span className="text-sm">{project.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        )}

        {project.target_completion_date && (
          <div className="flex justify-between">
            <span className="text-gray-600">Due:</span>
            <span className="text-sm">
              {new Date(project.target_completion_date).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        {onView && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(project.id)}
          >
            View
          </Button>
        )}
        {onEdit && (
          <Button size="sm" onClick={() => onEdit(project.id)}>
            Edit
          </Button>
        )}
      </div>
    </Card>
  );
};

// ============================================================================
// Contractor Card
// ============================================================================

interface Contractor {
  id: string;
  full_name: string;
  email: string;
  states_licensed: string[];
  specialty_tags: string[];
  availability: string;
  rating?: number;
}

interface ContractorCardProps {
  contractor: Contractor;
  onSelect?: (id: string) => void;
  onViewProfile?: (id: string) => void;
}

export const ContractorCard: React.FC<ContractorCardProps> = ({
  contractor,
  onSelect,
  onViewProfile,
}) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-semibold">{contractor.full_name}</h3>
          <p className="text-sm text-gray-600">{contractor.email}</p>
        </div>
        {contractor.rating && (
          <div className="text-yellow-500">⭐ {contractor.rating}</div>
        )}
      </div>

      <div className="my-4">
        <div className="mb-2">
          <p className="text-xs text-gray-600 mb-1">States Licensed:</p>
          <div className="flex flex-wrap gap-1">
            {contractor.states_licensed.map((state) => (
              <Badge key={state} variant="info">
                {state}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs text-gray-600 mb-1">Specialties:</p>
          <div className="flex flex-wrap gap-1">
            {contractor.specialty_tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 px-2 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <p className="text-sm">
            <span
              className={
                contractor.availability === "available"
                  ? "text-green-600"
                  : "text-orange-600"
              }
            >
              {contractor.availability === "available"
                ? "✓ Available"
                : "⏱ Booked"}
            </span>
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        {onSelect && (
          <Button size="sm" onClick={() => onSelect(contractor.id)}>
            Select
          </Button>
        )}
        {onViewProfile && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewProfile(contractor.id)}
          >
            Profile
          </Button>
        )}
      </div>
    </Card>
  );
};

// ============================================================================
// Contract Status Steps
// ============================================================================

interface ContractStepsProps {
  status:
    | "draft"
    | "signed"
    | "executed"
    | "completed"
    | "disputed";
  contractorSigned?: boolean;
  customerSigned?: boolean;
  complianceApproved?: boolean;
}

export const ContractSteps: React.FC<ContractStepsProps> = ({
  status,
  contractorSigned,
  customerSigned,
  complianceApproved,
}) => {
  const steps = [
    { label: "Draft", completed: true },
    {
      label: "Contractor Signs",
      completed: status !== "draft" && contractorSigned,
    },
    {
      label: "Customer Signs",
      completed: status !== "draft" && customerSigned,
    },
    { label: "Compliance Review", completed: complianceApproved },
    { label: "Executed", completed: status === "executed" || status === "completed" },
  ];

  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center">
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center
              ${
                step.completed
                  ? "bg-green-600 text-white"
                  : "bg-gray-300 text-gray-600"
              }
            `}
          >
            {step.completed ? "✓" : index + 1}
          </div>
          <span className="text-sm ml-2 text-gray-700">{step.label}</span>

          {index < steps.length - 1 && (
            <div
              className={`
                flex-1 h-1 mx-2
                ${step.completed ? "bg-green-600" : "bg-gray-300"}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Compliance Status Component
// ============================================================================

interface ComplianceStatusProps {
  decision: "approved" | "blocked" | "review-required";
  riskScore: number;
  factors?: string[];
}

export const ComplianceStatus: React.FC<ComplianceStatusProps> = ({
  decision,
  riskScore,
  factors = [],
}) => {
  const decisionStyles: Record<string, string> = {
    approved: "border-green-200 bg-green-50",
    blocked: "border-red-200 bg-red-50",
    "review-required": "border-yellow-200 bg-yellow-50",
  };

  const decisionLabels: Record<string, string> = {
    approved: "✓ Approved",
    blocked: "✗ Blocked",
    "review-required": "⚠ Review Required",
  };

  const riskColor =
    riskScore > 75 ? "text-red-600" : riskScore > 50 ? "text-yellow-600" : "text-green-600";

  return (
    <Card className={`border-l-4 ${decisionStyles[decision]}`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold">Compliance Check</h3>
        <Badge
          variant={
            decision === "approved"
              ? "success"
              : decision === "blocked"
              ? "error"
              : "warning"
          }
        >
          {decisionLabels[decision]}
        </Badge>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600">Risk Score:</span>
          <span className={`text-2xl font-bold ${riskColor}`}>{riskScore}/100</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full ${
              riskScore > 75
                ? "bg-red-600"
                : riskScore > 50
                ? "bg-yellow-600"
                : "bg-green-600"
            }`}
            style={{ width: `${riskScore}%` }}
          />
        </div>
      </div>

      {factors.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Risk Factors:</p>
          <ul className="space-y-1">
            {factors.map((factor, index) => (
              <li key={index} className="text-sm">
                • {factor}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};

// ============================================================================
// Escrow Status Component
// ============================================================================

interface EscrowStatusProps {
  heldAmount: number;
  releaseConditions: Record<string, boolean>;
  releasedAt?: string;
}

export const EscrowStatus: React.FC<EscrowStatusProps> = ({
  heldAmount,
  releaseConditions,
  releasedAt,
}) => {
  const allMet = Object.values(releaseConditions).every((v) => v === true);

  return (
    <Card className="border-l-4 border-blue-200">
      <h3 className="text-lg font-semibold mb-4">Escrow Status</h3>

      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Amount Held:</span>
          <span className="font-semibold">${heldAmount.toLocaleString()}</span>
        </div>
      </div>

      {releasedAt ? (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <p className="text-green-800">
            ✓ Released on {new Date(releasedAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600 mb-3">Release Conditions:</p>
          <div className="space-y-2">
            {Object.entries(releaseConditions).map(([condition, met]) => (
              <div key={condition} className="flex items-center">
                <div
                  className={`w-4 h-4 rounded mr-2 flex items-center justify-center text-xs text-white ${
                    met ? "bg-green-600" : "bg-gray-400"
                  }`}
                >
                  {met ? "✓" : "○"}
                </div>
                <span className="text-sm capitalize">{condition}</span>
              </div>
            ))}
          </div>

          {allMet && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded p-3">
              <p className="text-green-800 text-sm">
                ✓ All conditions met. Ready to release.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
