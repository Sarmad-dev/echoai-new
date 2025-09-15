import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

/**
 * GET /api/workflows/advanced-features
 *
 * Retrieves advanced workflow features and capabilities
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const feature = searchParams.get("feature");

    const advancedFeatures = {
      conditionalLogic: {
        id: "conditional-logic",
        name: "Conditional Logic Nodes",
        description:
          "Create complex decision trees with multiple conditions and branches",
        capabilities: [
          "Multiple condition evaluation",
          "Logical operators (AND, OR)",
          "Dynamic branching",
          "Custom expressions",
          "Field validation",
        ],
        operators: [
          "equals",
          "not_equals",
          "greater_than",
          "less_than",
          "contains",
          "not_contains",
          "exists",
          "not_exists",
        ],
        maxConditions: 10,
        maxBranches: 8,
      },
      delayScheduling: {
        id: "delay-scheduling",
        name: "Delay & Scheduling",
        description:
          "Add time-based delays and scheduling to workflow execution",
        capabilities: [
          "Fixed delays",
          "Dynamic delays with expressions",
          "Cron-based scheduling",
          "Recurring patterns",
          "Conditional delays",
          "Time zone support",
        ],
        delayTypes: ["fixed", "dynamic", "scheduled", "conditional"],
        maxDelay: 86400000, // 24 hours in milliseconds
        supportedTimeZones: [
          "UTC",
          "America/New_York",
          "America/Los_Angeles",
          "Europe/London",
          "Europe/Paris",
          "Asia/Tokyo",
        ],
      },
      analytics: {
        id: "workflow-analytics",
        name: "Workflow Analytics",
        description: "Comprehensive performance monitoring and insights",
        capabilities: [
          "Real-time metrics",
          "Historical trends",
          "Node-level performance",
          "Error analysis",
          "Bottleneck detection",
          "Custom dashboards",
        ],
        metrics: [
          "execution_count",
          "success_rate",
          "average_execution_time",
          "error_rate",
          "throughput",
          "cost_per_execution",
        ],
        retentionPeriod: "90 days",
        realTimeUpdates: true,
      },
      abTesting: {
        id: "ab-testing",
        name: "A/B Testing Framework",
        description: "Optimize workflows through controlled experimentation",
        capabilities: [
          "Multi-variant testing",
          "Statistical significance",
          "Traffic splitting",
          "Custom metrics",
          "Automated winner selection",
          "Performance comparison",
        ],
        maxVariants: 5,
        minSampleSize: 100,
        confidenceLevels: [90, 95, 99],
        supportedMetrics: [
          "conversion_rate",
          "execution_time",
          "success_rate",
          "cost_per_execution",
          "custom",
        ],
      },
    };

    if (feature) {
      const requestedFeature =
        advancedFeatures[feature as keyof typeof advancedFeatures];
      if (!requestedFeature) {
        return NextResponse.json(
          { error: "Feature not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: requestedFeature,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        features: advancedFeatures,
        totalFeatures: Object.keys(advancedFeatures).length,
        version: "1.0.0",
      },
    });
  } catch (error) {
    console.error("Error fetching advanced features:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch advanced features",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows/advanced-features
 *
 * Validates and processes advanced workflow feature configurations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { featureType, configuration, workflowId } = body;

    if (!featureType || !configuration) {
      return NextResponse.json(
        { error: "Feature type and configuration are required" },
        { status: 400 }
      );
    }

    // Validate configuration based on feature type
    const validationResult = await validateFeatureConfiguration(
      featureType,
      configuration
    );

    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: "Invalid configuration",
          details: validationResult.errors,
        },
        { status: 400 }
      );
    }

    // Process the configuration
    const processedConfig = await processFeatureConfiguration(
      featureType,
      configuration,
      workflowId,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      data: {
        featureType,
        configuration: processedConfig,
        validation: validationResult,
        workflowId,
      },
    });
  } catch (error) {
    console.error("Error processing advanced feature configuration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process feature configuration",
      },
      { status: 500 }
    );
  }
}

/**
 * Validates feature configuration based on type
 */
async function validateFeatureConfiguration(
  featureType: string,
  configuration: Record<string, unknown>
): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (featureType) {
    case "conditional-logic":
      if (
        !configuration.conditions ||
        !Array.isArray(configuration.conditions)
      ) {
        errors.push("Conditions array is required");
      } else {
        if (configuration.conditions.length === 0) {
          warnings.push("No conditions defined");
        }

        if (configuration.conditions.length > 10) {
          errors.push("Maximum 10 conditions allowed");
        }

        configuration.conditions.forEach(
          (condition: Record<string, unknown>, index: number) => {
            if (!condition.field) {
              errors.push(`Condition ${index + 1}: Field is required`);
            }
            if (!condition.operator) {
              errors.push(`Condition ${index + 1}: Operator is required`);
            }
            if (condition.value === undefined || condition.value === null) {
              errors.push(`Condition ${index + 1}: Value is required`);
            }
          }
        );
      }

      if (!configuration.branches || !Array.isArray(configuration.branches)) {
        errors.push("Branches array is required");
      } else {
        if (configuration.branches.length < 2) {
          errors.push("At least 2 branches are required");
        }
        if (configuration.branches.length > 8) {
          errors.push("Maximum 8 branches allowed");
        }
      }
      break;

    case "delay-scheduling":
      if (!configuration.delayType) {
        errors.push("Delay type is required");
      }

      switch (configuration.delayType) {
        case "fixed":
          if (
            !configuration.duration ||
            typeof configuration.duration !== "number" ||
            configuration.duration <= 0
          ) {
            errors.push("Duration must be greater than 0");
          }
          if (!configuration.unit) {
            errors.push("Time unit is required");
          }
          break;

        case "dynamic":
          if (!configuration.expression) {
            errors.push("Expression is required for dynamic delays");
          }
          break;

        case "scheduled":
          if (!configuration.scheduleType) {
            errors.push("Schedule type is required");
          }

          if (
            configuration.scheduleType === "cron" &&
            !configuration.cronExpression
          ) {
            errors.push("Cron expression is required");
          }

          if (
            configuration.scheduleType === "date" &&
            !configuration.scheduledDate
          ) {
            errors.push("Scheduled date is required");
          }
          break;

        case "conditional":
          if (!configuration.condition) {
            errors.push("Condition is required for conditional delays");
          }
          if (
            !configuration.conditionalDuration ||
            typeof configuration.conditionalDuration !== "number" ||
            configuration.conditionalDuration <= 0
          ) {
            errors.push("Conditional duration must be greater than 0");
          }
          break;
      }

      // Check maximum delay limit
      const maxDelay = 86400000; // 24 hours
      if (
        configuration.duration &&
        configuration.unit &&
        typeof configuration.duration === "number" &&
        typeof configuration.unit === "string"
      ) {
        const durationMs = convertToMilliseconds(
          configuration.duration,
          configuration.unit
        );
        if (durationMs > maxDelay) {
          errors.push("Delay cannot exceed 24 hours");
        }
      }
      break;

    case "ab-testing":
      if (!configuration.name) {
        errors.push("Test name is required");
      }

      if (!configuration.variants || !Array.isArray(configuration.variants)) {
        errors.push("Variants array is required");
      } else {
        if (configuration.variants.length < 2) {
          errors.push("At least 2 variants are required");
        }
        if (configuration.variants.length > 5) {
          errors.push("Maximum 5 variants allowed");
        }

        const controlVariants = configuration.variants.filter(
          (v: Record<string, unknown>) => v.isControl
        );
        if (controlVariants.length !== 1) {
          errors.push("Exactly one control variant is required");
        }
      }

      if (!configuration.metrics || !Array.isArray(configuration.metrics)) {
        errors.push("Metrics array is required");
      } else {
        if (configuration.metrics.length === 0) {
          errors.push("At least one metric is required");
        }

        const primaryMetrics = configuration.metrics.filter(
          (m: Record<string, unknown>) => m.isPrimary
        );
        if (primaryMetrics.length !== 1) {
          errors.push("Exactly one primary metric is required");
        }
      }

      if (
        configuration.minSampleSize &&
        typeof configuration.minSampleSize === "number" &&
        configuration.minSampleSize < 100
      ) {
        warnings.push("Sample size below 100 may not provide reliable results");
      }
      break;

    default:
      errors.push(`Unknown feature type: ${featureType}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Processes and optimizes feature configuration
 */
async function processFeatureConfiguration(
  featureType: string,
  configuration: Record<string, unknown>,
  workflowId?: string,
  userId?: string
): Promise<Record<string, unknown>> {
  const processedConfig = { ...configuration };

  switch (featureType) {
    case "conditional-logic":
      // Optimize condition evaluation order
      if (processedConfig.conditions && Array.isArray(processedConfig.conditions)) {
        processedConfig.conditions = (processedConfig.conditions as Array<Record<string, unknown>>).sort(
          (a: Record<string, unknown>, b: Record<string, unknown>) => {
            // Put simpler conditions first for faster evaluation
            const aComplexity = getConditionComplexity(a);
            const bComplexity = getConditionComplexity(b);
            return aComplexity - bComplexity;
          }
        );
      }

      // Generate optimized evaluation expression
      processedConfig.evaluationExpression = generateEvaluationExpression(
        processedConfig.conditions as Array<Record<string, unknown>>
      );
      break;

    case "delay-scheduling":
      // Convert all delays to milliseconds for consistency
      if (
        processedConfig.delayType === "fixed" &&
        typeof processedConfig.duration === "number" &&
        typeof processedConfig.unit === "string"
      ) {
        processedConfig.delayMs = convertToMilliseconds(
          processedConfig.duration,
          processedConfig.unit
        );
      }

      // Validate cron expressions
      if (
        processedConfig.delayType === "scheduled" &&
        typeof processedConfig.cronExpression === "string"
      ) {
        processedConfig.nextExecution = calculateNextExecution(
          processedConfig.cronExpression
        );
      }

      // Add safety limits
      processedConfig.maxDelayMs = 86400000; // 24 hours
      break;

    case "ab-testing":
      // Calculate traffic split
      const totalTraffic = (
        processedConfig.variants as Array<Record<string, unknown>>
      ).reduce(
        (sum: number, variant: Record<string, unknown>) =>
          sum + (Number(variant.trafficPercentage) || 0),
        0
      );

      if (totalTraffic !== 100) {
        // Auto-balance traffic split
        const equalSplit = Math.floor(
          100 /
            (processedConfig.variants as Array<Record<string, unknown>>).length
        );
        (processedConfig.variants as Array<Record<string, unknown>>).forEach(
          (variant: Record<string, unknown>, index: number) => {
            variant.trafficPercentage =
              index === 0
                ? equalSplit +
                  (100 -
                    equalSplit *
                      (
                        processedConfig.variants as Array<
                          Record<string, unknown>
                        >
                      ).length)
                : equalSplit;
          }
        );
      }

      // Generate test configuration
      processedConfig.testId = `test_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      processedConfig.createdAt = new Date().toISOString();
      processedConfig.createdBy = userId;
      break;
  }

  // Add metadata
  processedConfig.processedAt = new Date().toISOString();
  processedConfig.version = "1.0.0";

  if (workflowId) {
    processedConfig.workflowId = workflowId;
  }

  return processedConfig;
}

/**
 * Helper functions
 */
function convertToMilliseconds(duration: number, unit: string): number {
  const multipliers = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  };

  return duration * (multipliers[unit as keyof typeof multipliers] || 1000);
}

function getConditionComplexity(condition: Record<string, unknown>): number {
  // Simple scoring system for condition complexity
  let complexity = 1;

  if (
    condition.operator === "contains" ||
    condition.operator === "not_contains"
  ) {
    complexity += 2; // String operations are more expensive
  }

  if (typeof condition.value === "string" && condition.value.length > 100) {
    complexity += 1; // Long strings are more expensive to compare
  }

  return complexity;
}

function generateEvaluationExpression(
  conditions: Array<Record<string, unknown>>
): string {
  if (!conditions || conditions.length === 0) {
    return "true";
  }

  return conditions
    .map((condition, index) => {
      const prefix = index > 0 ? ` ${condition.logicalOperator || "AND"} ` : "";
      return `${prefix}(${condition.field} ${
        condition.operator
      } ${JSON.stringify(condition.value)})`;
    })
    .join("");
}

function calculateNextExecution(_cronExpression: string): string {
  // Simplified cron calculation - in production, use a proper cron library
  const now = new Date();
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
  return nextHour.toISOString();
}
