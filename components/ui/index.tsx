/**
 * UI Component Library - Basic Components
 * 
 * Reusable components for authentication, forms, and navigation
 */

import React, { ReactNode } from "react";

// ============================================================================
// Button Component
// ============================================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  children,
  className,
  ...props
}) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-300 text-black hover:bg-gray-400",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50",
  };

  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`
        rounded transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className || ""}
      `}
      {...props}
    >
      {isLoading ? <span>Loading...</span> : children}
    </button>
  );
};

// ============================================================================
// Input Component
// ============================================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const TextInput: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-2 border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? "border-red-500" : "border-gray-300"}
          ${className || ""}
        `}
        {...props}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      {helperText && !error && (
        <p className="text-gray-500 text-sm mt-1">{helperText}</p>
      )}
    </div>
  );
};

// ============================================================================
// Select Component
// ============================================================================

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  className,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <select
        className={`
          w-full px-4 py-2 border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? "border-red-500" : "border-gray-300"}
          ${className || ""}
        `}
        {...props}
      >
        <option value="">Select an option...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

// ============================================================================
// Card Component
// ============================================================================

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, children, className }) => {
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className || ""}`}>
      {title && <h2 className="text-xl font-semibold mb-4">{title}</h2>}
      {children}
    </div>
  );
};

// ============================================================================
// Badge Component (for status)
// ============================================================================

interface BadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  children: ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  children,
}) => {
  const variants = {
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
    neutral: "bg-gray-100 text-gray-800",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm ${variants[variant]}`}>
      {children}
    </span>
  );
};

// ============================================================================
// Form Container
// ============================================================================

interface FormContainerProps {
  title: string;
  subtitle?: string;
  onSubmit: (e: React.FormEvent) => void;
  children: ReactNode;
  submitButtonText?: string;
  isSubmitting?: boolean;
}

export const FormContainer: React.FC<FormContainerProps> = ({
  title,
  subtitle,
  onSubmit,
  children,
  submitButtonText = "Submit",
  isSubmitting = false,
}) => {
  return (
    <div className="max-w-md mx-auto">
      <Card className="mt-8">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        {subtitle && <p className="text-gray-600 mb-6">{subtitle}</p>}

        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className="w-full mt-6"
          >
            {submitButtonText}
          </Button>
        </form>
      </Card>
    </div>
  );
};

// ============================================================================
// Alert Component
// ============================================================================

interface AlertProps {
  type: "success" | "error" | "warning" | "info";
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  message,
  dismissible,
  onDismiss,
}) => {
  const styles = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div className={`border rounded-lg p-4 ${styles[type]}`}>
      <div className="flex justify-between items-start">
        <div>
          {title && (
            <h3 className="font-semibold mb-1">{title}</h3>
          )}
          <p>{message}</p>
        </div>
        {dismissible && (
          <button
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-700 ml-4"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Loading Spinner
// ============================================================================

export const Spinner: React.FC<{ size?: "sm" | "md" | "lg" }> = ({
  size = "md",
}) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex justify-center items-center">
      <div
        className={`${sizes[size]} border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin`}
      />
    </div>
  );
};

// ============================================================================
// Modal Component
// ============================================================================

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  children,
  onClose,
  actions,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="mb-4">{children}</div>

        {actions && <div className="flex gap-2 justify-end">{actions}</div>}
      </Card>
    </div>
  );
};

// ============================================================================
// Navigation Component
// ============================================================================

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

interface NavigationProps {
  items: NavItem[];
  currentPath: string;
  onLogout?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  items,
  currentPath,
  onLogout,
}) => {
  return (
    <nav className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">JGA</h1>

          <div className="flex gap-8">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`
                  transition-colors duration-200
                  ${
                    currentPath === item.href
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-gray-300 hover:text-white"
                  }
                `}
              >
                {item.label}
              </a>
            ))}
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
