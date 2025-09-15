"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const hubspotConfigSchema = z.object({
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
  fieldMappings: z.object({
    contact: z.record(z.string(), z.string()).optional(),
    deal: z.record(z.string(), z.string()).optional(),
    company: z.record(z.string(), z.string()).optional(),
  }),
  defaultPipeline: z.string().optional(),
  defaultDealStage: z.string().optional(),
  autoCreateDeals: z.boolean(),
  autoCreateCompanies: z.boolean(),
});

type HubSpotConfigForm = z.infer<typeof hubspotConfigSchema>;

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description?: string;
  groupName?: string;
  options?: Array<{
    label: string;
    value: string;
  }>;
}

interface HubSpotPipeline {
  id: string;
  label: string;
  stages: Array<{
    id: string;
    label: string;
    displayOrder: number;
  }>;
}

interface HubSpotConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId?: string;
  onSave: (config: HubSpotConfigForm) => Promise<void>;
}

const AVAILABLE_SCOPES = [
  {
    id: "crm.objects.contacts.read",
    label: "Read Contacts",
    description: "View contact information",
    required: true,
  },
  {
    id: "crm.objects.contacts.write",
    label: "Write Contacts",
    description: "Create and update contacts",
    required: true,
  },
  {
    id: "crm.objects.deals.read",
    label: "Read Deals",
    description: "View deal information",
    required: false,
  },
  {
    id: "crm.objects.deals.write",
    label: "Write Deals",
    description: "Create and update deals",
    required: false,
  },
  {
    id: "crm.objects.companies.read",
    label: "Read Companies",
    description: "View company information",
    required: false,
  },
  {
    id: "crm.objects.companies.write",
    label: "Write Companies",
    description: "Create and update companies",
    required: false,
  },
  {
    id: "timeline",
    label: "Timeline Events",
    description: "Create timeline events and notes",
    required: false,
  },
];

const COMMON_FIELD_MAPPINGS = {
  contact: {
    "User Email": "email",
    "First Name": "firstname",
    "Last Name": "lastname",
    "Company Name": "company",
    "Phone Number": "phone",
    Website: "website",
    "Lead Source": "lead_source",
    "Lifecycle Stage": "lifecyclestage",
  },
  deal: {
    "Deal Name": "dealname",
    "Deal Amount": "amount",
    "Close Date": "closedate",
    "Deal Stage": "dealstage",
    Pipeline: "pipeline",
    "Deal Owner": "hubspot_owner_id",
  },
  company: {
    "Company Name": "name",
    Domain: "domain",
    Industry: "industry",
    Phone: "phone",
    City: "city",
    State: "state",
    Country: "country",
  },
};

export function HubSpotConfigDialog({
  open,
  onOpenChange,
  integrationId,
  onSave,
}: HubSpotConfigDialogProps) {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    error?: string;
    portalId?: string;
  } | null>(null);
  const [properties, setProperties] = useState<{
    contact: HubSpotProperty[];
    deal: HubSpotProperty[];
    company: HubSpotProperty[];
  }>({
    contact: [],
    deal: [],
    company: [],
  });
  const [pipelines, setPipelines] = useState<HubSpotPipeline[]>([]);

  const form = useForm<HubSpotConfigForm>({
    resolver: zodResolver(hubspotConfigSchema),
    defaultValues: {
      scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"],
      fieldMappings: {
        contact: COMMON_FIELD_MAPPINGS.contact,
        deal: COMMON_FIELD_MAPPINGS.deal,
        company: COMMON_FIELD_MAPPINGS.company,
      },
      autoCreateDeals: false,
      autoCreateCompanies: false,
    },
  });

  useEffect(() => {
    if (open && integrationId) {
      loadHubSpotData();
    }
  }, [open, integrationId]);

  const loadHubSpotData = async () => {
    if (!integrationId) return;

    setLoading(true);
    try {
      // Test connection first
      await testConnection();

      // Load properties and pipelines in parallel
      const [propertiesResponse, pipelinesResponse] = await Promise.all([
        fetch(
          `/api/integrations/hubspot/properties?integrationId=${integrationId}`
        ),
        fetch(
          `/api/integrations/hubspot/pipelines?integrationId=${integrationId}`
        ),
      ]);

      if (propertiesResponse.ok) {
        const propertiesData = await propertiesResponse.json();
        setProperties(propertiesData);
      }

      if (pipelinesResponse.ok) {
        const pipelinesData = await pipelinesResponse.json();
        setPipelines(pipelinesData.pipelines || []);

        // Set default pipeline if available
        if (pipelinesData.pipelines?.length > 0) {
          form.setValue("defaultPipeline", pipelinesData.pipelines[0].id);
          if (pipelinesData.pipelines[0].stages?.length > 0) {
            form.setValue(
              "defaultDealStage",
              pipelinesData.pipelines[0].stages[0].id
            );
          }
        }
      }
    } catch (error) {
      console.error("Error loading HubSpot data:", error);
      toast.error("Failed to load HubSpot configuration data");
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!integrationId) return;

    setTestingConnection(true);
    try {
      const response = await fetch("/api/integrations/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrationId,
        }),
      });

      const result = await response.json();
      setConnectionStatus(result);

      if (!result.success) {
        toast.error("Connection Test Failed", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus({
        success: false,
        error: "Failed to test connection",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async (data: HubSpotConfigForm) => {
    try {
      await onSave(data);
      onOpenChange(false);
      toast.success("HubSpot configuration saved successfully");
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error("Failed to save configuration");
    }
  };

  const selectedPipeline = pipelines.find(
    (p) => p.id === form.watch("defaultPipeline")
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img
              src="https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png"
              alt="HubSpot"
              className="w-6 h-6"
            />
            HubSpot Integration Configuration
          </DialogTitle>
          <DialogDescription>
            Configure your HubSpot integration settings, field mappings, and
            automation preferences.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading HubSpot configuration...</span>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSave)}
              className="space-y-6"
            >
              {/* Connection Status */}
              {connectionStatus && (
                <Alert
                  className={
                    connectionStatus.success
                      ? "border-green-200"
                      : "border-red-200"
                  }
                >
                  {connectionStatus.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription>
                    {connectionStatus.success ? (
                      <div>
                        <strong>Connection successful!</strong>
                        {connectionStatus.portalId && (
                          <span className="ml-2">
                            Portal ID: {connectionStatus.portalId}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>
                        <strong>Connection failed:</strong>{" "}
                        {connectionStatus.error}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Scopes Selection */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Permissions & Scopes</h3>
                  <p className="text-sm text-muted-foreground">
                    Select the HubSpot permissions your automation workflows
                    will need.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="scopes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {AVAILABLE_SCOPES.map((scope) => (
                            <div
                              key={scope.id}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                field.value.includes(scope.id)
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              }`}
                              onClick={() => {
                                if (scope.required) return;

                                const newValue = field.value.includes(scope.id)
                                  ? field.value.filter((s) => s !== scope.id)
                                  : [...field.value, scope.id];
                                field.onChange(newValue);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {scope.label}
                                    </span>
                                    {scope.required && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        Required
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {scope.description}
                                  </p>
                                </div>
                                <div
                                  className={`w-4 h-4 rounded border-2 ${
                                    field.value.includes(scope.id)
                                      ? "bg-primary border-primary"
                                      : "border-border"
                                  }`}
                                >
                                  {field.value.includes(scope.id) && (
                                    <CheckCircle className="w-3 h-3 text-white" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Field Mappings */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Field Mappings</h3>
                  <p className="text-sm text-muted-foreground">
                    Map chatbot data to HubSpot properties. These mappings will
                    be used as defaults in automation workflows.
                  </p>
                </div>

                {/* Contact Field Mappings */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Contact Properties</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(COMMON_FIELD_MAPPINGS.contact).map(
                      ([label, defaultValue]) => (
                        <FormField
                          key={`contact.${defaultValue}`}
                          control={form.control}
                          name={`fieldMappings.contact.${defaultValue}` as keyof HubSpotConfigForm}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{label}</FormLabel>
                              <Select
                                value={(field.value as string) || defaultValue}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select HubSpot property" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {properties.contact.map((prop) => (
                                    <SelectItem
                                      key={prop.name}
                                      value={prop.name}
                                    >
                                      <div className="flex flex-col">
                                        <span>{prop.label}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {prop.name} ({prop.type})
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      )
                    )}
                  </div>
                </div>

                {/* Deal Field Mappings */}
                {form.watch("scopes").some((s) => s.includes("deals")) && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Deal Properties</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(COMMON_FIELD_MAPPINGS.deal).map(
                        ([label, defaultValue]) => (
                          <FormField
                            key={`deal.${defaultValue}`}
                            control={form.control}
                            name={`fieldMappings.deal.${defaultValue}` as keyof HubSpotConfigForm}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">
                                  {label}
                                </FormLabel>
                                <Select
                                  value={(field.value as string) || defaultValue}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Select HubSpot property" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {properties.deal.map((prop) => (
                                      <SelectItem
                                        key={prop.name}
                                        value={prop.name}
                                      >
                                        <div className="flex flex-col">
                                          <span>{prop.label}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {prop.name} ({prop.type})
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Pipeline Configuration */}
              {form.watch("scopes").some((s) => s.includes("deals")) &&
                pipelines.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">
                        Deal Pipeline Settings
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Configure default pipeline and stage for automatically
                        created deals.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="defaultPipeline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Pipeline</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select pipeline" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {pipelines.map((pipeline) => (
                                  <SelectItem
                                    key={pipeline.id}
                                    value={pipeline.id}
                                  >
                                    {pipeline.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="defaultDealStage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Deal Stage</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!selectedPipeline}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select stage" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {selectedPipeline?.stages
                                  .sort(
                                    (a, b) => a.displayOrder - b.displayOrder
                                  )
                                  .map((stage) => (
                                    <SelectItem key={stage.id} value={stage.id}>
                                      {stage.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

              <Separator />

              {/* Automation Settings */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Automation Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure default behavior for automated actions.
                  </p>
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="autoCreateDeals"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Auto-create Deals
                          </FormLabel>
                          <FormDescription>
                            Automatically create deals when high-value leads are
                            detected
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="autoCreateCompanies"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Auto-create Companies
                          </FormLabel>
                          <FormDescription>
                            Automatically create company records when company
                            information is detected
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={testingConnection || !integrationId}
                >
                  {testingConnection ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>
                <Button type="submit" disabled={!connectionStatus?.success}>
                  Save Configuration
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
