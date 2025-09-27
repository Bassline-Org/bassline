import React from 'react';

interface NotebookProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Notebook({ title, description, children, className = '' }: NotebookProps) {
  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      {title && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-2 text-gray-600">{description}</p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

interface NotebookSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function NotebookSection({ title, children, className = '' }: NotebookSectionProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}