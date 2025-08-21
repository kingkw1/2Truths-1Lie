/**
 * Challenge Creation Form Component
 * Implements UI for entering 3 statements with lie selection and validation
 * Requirements 1 & 3: Intuitive Core Game Loop and Game Difficulty/Engagement
 */

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import {
  startNewChallenge,
  updateStatement,
  setLieStatement,
  validateChallenge,
  enterPreviewMode,
  clearValidationErrors,
} from "../store/slices/challengeCreationSlice";
import { Statement } from "../types/challenge";

interface ChallengeCreationFormProps {
  onSubmit?: () => void;
  onCancel?: () => void;
}

export const ChallengeCreationForm: React.FC<ChallengeCreationFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const dispatch = useDispatch();
  const challengeCreationState = useSelector(
    (state: RootState) => state.challengeCreation,
  );

  // Safety check for Redux state
  if (!challengeCreationState) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <h3>Loading Challenge Creation...</h3>
          <p>Initializing Redux store...</p>
        </div>
      </div>
    );
  }

  const { currentChallenge, validationErrors, isSubmitting, previewMode } =
    challengeCreationState;

  const [localStatements, setLocalStatements] = useState<string[]>([
    "",
    "",
    "",
  ]);
  const [selectedLieIndex, setSelectedLieIndex] = useState<number | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  // Initialize challenge on component mount
  useEffect(() => {
    dispatch(startNewChallenge());
  }, [dispatch]);

  // Sync local state with Redux store (simplified to prevent conflicts)
  useEffect(() => {
    if (currentChallenge.statements && currentChallenge.statements.length === 3) {
      const lieIndex = currentChallenge.statements.findIndex(
        (stmt) => stmt && stmt.isLie,
      );
      setSelectedLieIndex(lieIndex >= 0 ? lieIndex : null);
    }
  }, [currentChallenge.statements]);

  // Debug logging (removed for performance)

  const handleStatementChange = (index: number, text: string) => {
    try {
      // Enforce character limit
      const limitedText = text.length > 280 ? text.substring(0, 280) : text;

      // Update local state immediately for responsive UI
      const newStatements = [...localStatements];
      newStatements[index] = limitedText;
      setLocalStatements(newStatements);

      // Update Redux store - keep spaces intact, only trim for validation
      const statement: Statement = {
        id: `stmt_${Date.now()}_${index}`,
        text: limitedText, // Don't trim here - preserve spaces
        isLie: selectedLieIndex === index,
        confidence: 0,
      };

      dispatch(updateStatement({ index, statement }));

      // Clear validation errors when user starts typing
      if (validationErrors.length > 0) {
        dispatch(clearValidationErrors());
        setShowValidation(false);
      }
    } catch (error) {
      console.error('Error updating statement:', error);
    }
  };

  const handleLieSelection = (index: number) => {
    setSelectedLieIndex(index);
    dispatch(setLieStatement(index));

    // Clear validation errors when lie is selected
    if (validationErrors.length > 0) {
      dispatch(clearValidationErrors());
      setShowValidation(false);
    }
  };

  const handleValidateAndPreview = () => {
    dispatch(validateChallenge());
    setShowValidation(true);

    // If no validation errors, enter preview mode
    if (validationErrors.length === 0) {
      dispatch(enterPreviewMode());
    }
  };

  const handleSubmit = () => {
    dispatch(validateChallenge());
    setShowValidation(true);

    if (validationErrors.length === 0 && onSubmit) {
      onSubmit();
    }
  };

  const isFormValid = () => {
    return (
      localStatements.every((stmt) => stmt.trim().length > 0) &&
      selectedLieIndex !== null &&
      localStatements.length === 3
    );
  };

  const getStatementPlaceholder = (index: number) => {
    const placeholders = [
      "Enter your first statement (this could be true or false)...",
      "Enter your second statement (this could be true or false)...",
      "Enter your third statement (this could be true or false)...",
    ];
    return placeholders[index];
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Create Your Challenge</h2>
        <p style={styles.subtitle}>
          Write three statements about yourself. Two should be true, and one
          should be a lie. Others will try to guess which one is the lie!
          Text is required for all statements.
        </p>
      </div>

      <div style={styles.statementsContainer}>
        {localStatements.map((statement, index) => (
          <div key={index} style={styles.statementGroup}>
            <div style={styles.statementHeader}>
              <span style={styles.statementNumber}>Statement {index + 1}</span>
              <button
                type="button"
                onClick={() => handleLieSelection(index)}
                style={{
                  ...styles.lieButton,
                  ...(selectedLieIndex === index
                    ? styles.lieButtonSelected
                    : {}),
                }}
                disabled={isSubmitting}
              >
                {selectedLieIndex === index
                  ? "✓ This is the lie"
                  : "Mark as lie"}
              </button>
            </div>

            <textarea
              value={statement}
              onChange={(e) => handleStatementChange(index, e.target.value)}
              placeholder={getStatementPlaceholder(index)}
              style={{
                ...styles.statementInput,
                ...(selectedLieIndex === index ? styles.statementInputLie : {}),
              }}
              disabled={isSubmitting}
              maxLength={280}
            />

            <div style={styles.characterCount}>
              {statement.length}/280 characters
            </div>
          </div>
        ))}
      </div>

      {/* Validation Errors */}
      {showValidation && validationErrors.length > 0 && (
        <div style={styles.errorContainer}>
          <h4 style={styles.errorTitle}>Please fix the following issues:</h4>
          <ul style={styles.errorList}>
            {validationErrors.map((error, index) => (
              <li key={index} style={styles.errorItem}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Form Status */}
      <div style={styles.statusContainer}>
        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Statements:</span>
          <span
            style={{
              ...styles.statusValue,
              color:
                localStatements.filter((s) => s.trim()).length === 3
                  ? "#10B981"
                  : "#EF4444",
            }}
          >
            {localStatements.filter((s) => s.trim()).length}/3
          </span>
        </div>

        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Lie selected:</span>
          <span
            style={{
              ...styles.statusValue,
              color: selectedLieIndex !== null ? "#10B981" : "#EF4444",
            }}
          >
            {selectedLieIndex !== null ? "Yes" : "No"}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.buttonContainer}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={styles.cancelButton}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}

        <button
          type="button"
          onClick={handleValidateAndPreview}
          style={{
            ...styles.previewButton,
            ...(isFormValid() ? {} : styles.buttonDisabled),
          }}
          disabled={!isFormValid() || isSubmitting}
        >
          {previewMode ? "Update Preview" : "Preview Challenge"}
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          style={{
            ...styles.submitButton,
            ...(isFormValid() ? {} : styles.buttonDisabled),
          }}
          disabled={!isFormValid() || isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Challenge"}
        </button>
      </div>

      {/* Preview Mode Indicator */}
      {previewMode && (
        <div style={styles.previewIndicator}>
          <span>🔍 Preview mode active - review your challenge above</span>
        </div>
      )}
    </div>
  );
};

// Styles
const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "24px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  } as React.CSSProperties,

  header: {
    marginBottom: "32px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  title: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: "8px",
  } as React.CSSProperties,

  subtitle: {
    fontSize: "16px",
    color: "#6B7280",
    lineHeight: "1.5",
  } as React.CSSProperties,

  statementsContainer: {
    marginBottom: "24px",
  } as React.CSSProperties,

  statementGroup: {
    marginBottom: "24px",
    padding: "16px",
    border: "2px solid #E5E7EB",
    borderRadius: "8px",
    backgroundColor: "#F9FAFB",
  } as React.CSSProperties,

  statementHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  } as React.CSSProperties,

  statementNumber: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#374151",
  } as React.CSSProperties,

  lieButton: {
    padding: "6px 12px",
    fontSize: "12px",
    border: "1px solid #D1D5DB",
    borderRadius: "6px",
    backgroundColor: "#FFFFFF",
    color: "#374151",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  lieButtonSelected: {
    backgroundColor: "#EF4444",
    color: "#FFFFFF",
    borderColor: "#EF4444",
  } as React.CSSProperties,

  statementInput: {
    width: "100%",
    minHeight: "80px",
    padding: "12px",
    fontSize: "16px",
    border: "2px solid #D1D5DB",
    borderRadius: "6px",
    resize: "vertical" as const,
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  } as React.CSSProperties,

  statementInputLie: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  } as React.CSSProperties,

  characterCount: {
    fontSize: "12px",
    color: "#9CA3AF",
    textAlign: "right" as const,
    marginTop: "4px",
  } as React.CSSProperties,

  errorContainer: {
    padding: "16px",
    backgroundColor: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: "8px",
    marginBottom: "24px",
  } as React.CSSProperties,

  errorTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: "8px",
  } as React.CSSProperties,

  errorList: {
    margin: 0,
    paddingLeft: "20px",
  } as React.CSSProperties,

  errorItem: {
    color: "#DC2626",
    fontSize: "14px",
    marginBottom: "4px",
  } as React.CSSProperties,

  statusContainer: {
    display: "flex",
    justifyContent: "space-around",
    padding: "16px",
    backgroundColor: "#F3F4F6",
    borderRadius: "8px",
    marginBottom: "24px",
  } as React.CSSProperties,

  statusItem: {
    textAlign: "center" as const,
  } as React.CSSProperties,

  statusLabel: {
    display: "block",
    fontSize: "12px",
    color: "#6B7280",
    marginBottom: "4px",
  } as React.CSSProperties,

  statusValue: {
    fontSize: "16px",
    fontWeight: "bold",
  } as React.CSSProperties,

  buttonContainer: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  } as React.CSSProperties,

  cancelButton: {
    padding: "12px 24px",
    fontSize: "16px",
    border: "1px solid #D1D5DB",
    borderRadius: "6px",
    backgroundColor: "#FFFFFF",
    color: "#374151",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  previewButton: {
    padding: "12px 24px",
    fontSize: "16px",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "#3B82F6",
    color: "#FFFFFF",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  submitButton: {
    padding: "12px 24px",
    fontSize: "16px",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "#10B981",
    color: "#FFFFFF",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,

  previewIndicator: {
    marginTop: "16px",
    padding: "12px",
    backgroundColor: "#EBF8FF",
    border: "1px solid #93C5FD",
    borderRadius: "6px",
    textAlign: "center" as const,
    fontSize: "14px",
    color: "#1E40AF",
  } as React.CSSProperties,
};

export default ChallengeCreationForm;
