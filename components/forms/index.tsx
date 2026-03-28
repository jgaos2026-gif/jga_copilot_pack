/**
 * Domain Forms
 * 
 * Pre-built forms for common JGA workflows
 */

import React, { useState } from "react";
import {
  FormContainer,
  TextInput,
  Select,
  Button,
  Alert,
} from "./ui/index";

// ============================================================================
// Login Form
// ============================================================================

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isLoading = false,
  error,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email, password);
  };

  return (
    <FormContainer
      title="Login to JGA"
      subtitle="Sign in to your account"
      onSubmit={handleSubmit}
      submitButtonText="Sign In"
      isSubmitting={isLoading}
    >
      {error && (
        <Alert
          type="error"
          title="Login Failed"
          message={error}
          dismissible
        />
      )}
      <TextInput
        label="Email"
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <TextInput
        label="Password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <div className="text-sm text-center">
        <a href="/forgot-password" className="text-blue-600 hover:underline">
          Forgot password?
        </a>
      </div>
    </FormContainer>
  );
};

// ============================================================================
// Register Form
// ============================================================================

interface RegisterFormProps {
  onSubmit: (data: {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
  }) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  isLoading = false,
  error,
}) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });

  const [passwordError, setPasswordError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordError("");
    await onSubmit(formData);
  };

  return (
    <FormContainer
      title="Create Account"
      subtitle="Join JGA"
      onSubmit={handleSubmit}
      submitButtonText="Register"
      isSubmitting={isLoading}
    >
      {error && (
        <Alert
          type="error"
          title="Registration Failed"
          message={error}
          dismissible
        />
      )}
      <TextInput
        label="Full Name"
        placeholder="John Doe"
        value={formData.fullName}
        onChange={(e) => handleChange(e, "fullName")}
        required
      />
      <TextInput
        label="Email"
        type="email"
        placeholder="your@email.com"
        value={formData.email}
        onChange={(e) => handleChange(e, "email")}
        required
      />
      <TextInput
        label="Password"
        type="password"
        placeholder="••••••••"
        value={formData.password}
        onChange={(e) => handleChange(e, "password")}
        helperText="At least 8 characters"
        required
      />
      <TextInput
        label="Confirm Password"
        type="password"
        placeholder="••••••••"
        value={formData.confirmPassword}
        onChange={(e) => handleChange(e, "confirmPassword")}
        error={passwordError}
        required
      />
    </FormContainer>
  );
};

// ============================================================================
// Project Creation Form
// ============================================================================

interface ProjectFormProps {
  onSubmit: (data: {
    name: string;
    description: string;
    serviceType: string;
    estimatedValue: number;
    contractorId: string;
    customerId: string;
    state: string;
  }) => Promise<void>;
  contractors: Array<{ id: string; full_name: string }>;
  customers: Array<{ id: string; company_name: string }>;
  isLoading?: boolean;
  error?: string;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  onSubmit,
  contractors,
  customers,
  isLoading = false,
  error,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    serviceType: "",
    estimatedValue: 0,
    contractorId: "",
    customerId: "",
    state: "CA",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    field: string
  ) => {
    setFormData({
      ...formData,
      [field]:
        field === "estimatedValue"
          ? parseFloat(e.target.value) || 0
          : e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <FormContainer
      title="Create New Project"
      onSubmit={handleSubmit}
      submitButtonText="Create Project"
      isSubmitting={isLoading}
    >
      {error && (
        <Alert
          type="error"
          title="Creation Failed"
          message={error}
          dismissible
        />
      )}

      <TextInput
        label="Project Name"
        placeholder="e.g., Website Redesign"
        value={formData.name}
        onChange={(e) => handleChange(e, "name")}
        required
      />

      <TextInput
        label="Description"
        placeholder="Brief project description"
        value={formData.description}
        onChange={(e) => handleChange(e, "description")}
      />

      <Select
        label="Service Type"
        options={[
          { value: "graphic-design", label: "Graphic Design" },
          { value: "video-production", label: "Video Production" },
          { value: "web-design", label: "Web Design" },
          { value: "copywriting", label: "Copywriting" },
          { value: "other", label: "Other" },
        ]}
        value={formData.serviceType}
        onChange={(e) => handleChange(e, "serviceType")}
        required
      />

      <TextInput
        label="Estimated Value ($)"
        type="number"
        placeholder="5000"
        value={formData.estimatedValue}
        onChange={(e) => handleChange(e, "estimatedValue")}
        required
      />

      <Select
        label="Customer"
        options={customers.map((c) => ({
          value: c.id,
          label: c.company_name,
        }))}
        value={formData.customerId}
        onChange={(e) => handleChange(e, "customerId")}
        required
      />

      <Select
        label="Contractor"
        options={contractors.map((c) => ({
          value: c.id,
          label: c.full_name,
        }))}
        value={formData.contractorId}
        onChange={(e) => handleChange(e, "contractorId")}
        required
      />

      <Select
        label="State"
        options={[
          { value: "CA", label: "California" },
          { value: "IL", label: "Illinois" },
          { value: "TX", label: "Texas" },
        ]}
        value={formData.state}
        onChange={(e) => handleChange(e, "state")}
        required
      />
    </FormContainer>
  );
};

// ============================================================================
// MFA Setup Form
// ============================================================================

interface MFASetupFormProps {
  onSubmit: (code: string) => Promise<void>;
  qrCode: string;
  totpSecret: string;
  isLoading?: boolean;
  error?: string;
}

export const MFASetupForm: React.FC<MFASetupFormProps> = ({
  onSubmit,
  qrCode,
  totpSecret,
  isLoading = false,
  error,
}) => {
  const [code, setCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(code);
  };

  return (
    <FormContainer
      title="Setup Two-Factor Authentication"
      subtitle="Secure your account with MFA"
      onSubmit={handleSubmit}
      submitButtonText="Verify & Enable"
      isSubmitting={isLoading}
    >
      {error && (
        <Alert
          type="error"
          title="Verification Failed"
          message={error}
          dismissible
        />
      )}

      <div className="bg-gray-100 p-4 rounded-lg text-center mb-4">
        <img src={qrCode} alt="QR Code" className="w-48 h-48 mx-auto" />
        <p className="text-xs text-gray-600 mt-2">Scan with authenticator app</p>
      </div>

      <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-4">
        <p className="text-xs text-gray-600 mb-1">Or enter code manually:</p>
        <p className="font-mono text-sm break-all">{totpSecret}</p>
      </div>

      <TextInput
        label="Verification Code"
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        maxLength={6}
        required
      />

      <p className="text-xs text-gray-600">
        Enter the 6-digit code from your authenticator app
      </p>
    </FormContainer>
  );
};
