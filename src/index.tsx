import {
  List,
  ActionPanel,
  Action,
  Form,
  showToast,
  Toast,
  LocalStorage,
  useNavigation,
  confirmAlert,
  Alert,
  closeMainWindow,
  environment,
} from "@raycast/api";
import { execSync, execFileSync } from "child_process";
import path from "path";
import { useEffect, useState } from "react";

interface Template {
  id: string;
  name: string;
  // JSON string: { [pasteboardType: string]: base64EncodedData }
  // Stores every format Notion puts on the clipboard — including its internal block format.
  clipboardData: string;
  preview: string;
}

const STORAGE_KEY = "templates";
const BRIDGE = path.join(environment.assetsPath, "clipboard-bridge");

async function loadTemplates(): Promise<Template[]> {
  const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function saveTemplates(templates: Template[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function readAllClipboard(): { data: string; preview: string } | null {
  try {
    const data = execFileSync(BRIDGE, ["read"], { encoding: "utf8" }).trim();
    const formats = JSON.parse(data) as Record<string, string>;
    if (Object.keys(formats).length === 0) return null;

    const textB64 =
      formats["public.utf8-plain-text"] ??
      formats["NSStringPboardType"] ??
      formats["com.apple.traditional-mac-plain-text"];
    const preview = textB64 ? Buffer.from(textB64, "base64").toString("utf8") : "";

    return { data, preview };
  } catch {
    return null;
  }
}

function writeAllClipboard(clipboardData: string): void {
  execFileSync(BRIDGE, ["write"], { input: clipboardData, encoding: "utf8" });
}

// --- New Template Form ---

function NewTemplateForm({ onSave }: { onSave: () => void }) {
  const { pop } = useNavigation();
  const [name, setName] = useState("");
  const [captured, setCaptured] = useState<{ data: string; preview: string } | null>(null);

  async function captureClipboard() {
    const result = readAllClipboard();
    if (!result) {
      await showToast({ style: Toast.Style.Failure, title: "Clipboard is empty" });
      return;
    }
    setCaptured(result);
    await showToast({ style: Toast.Style.Success, title: "Clipboard captured" });
  }

  async function handleSave() {
    if (!name.trim()) {
      await showToast({ style: Toast.Style.Failure, title: "Name is required" });
      return;
    }
    if (!captured) {
      await showToast({ style: Toast.Style.Failure, title: "Capture clipboard content first" });
      return;
    }

    const templates = await loadTemplates();
    const newTemplate: Template = {
      id: Date.now().toString(),
      name: name.trim(),
      clipboardData: captured.data,
      preview: captured.preview,
    };
    await saveTemplates([...templates, newTemplate]);
    await showToast({ style: Toast.Style.Success, title: `Saved "${newTemplate.name}"` });
    onSave();
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action title="Save Template" onAction={handleSave} />
          <Action
            title="Capture from Clipboard"
            shortcut={{ modifiers: ["cmd"], key: "v" }}
            onAction={captureClipboard}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="e.g. Meeting notes header"
        value={name}
        onChange={setName}
      />
      <Form.Description
        title="Clipboard"
        text={
          captured
            ? `Ready — "${captured.preview.slice(0, 60).trim()}${captured.preview.length > 60 ? "…" : ""}"`
            : "Not captured yet. Copy a Notion block, then press ⌘V."
        }
      />
    </Form>
  );
}

// --- Main List ---

export default function Command() {
  const { push } = useNavigation();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    const data = await loadTemplates();
    setTemplates(data);
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function pasteTemplate(template: Template) {
    try {
      // Restore the exact clipboard state Notion originally put there
      writeAllClipboard(template.clipboardData);
      // Close Raycast and let the previous app (Notion) regain focus
      await closeMainWindow();
      // Small delay for focus to transfer, then simulate CMD+V
      await new Promise((resolve) => setTimeout(resolve, 150));
      execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Paste failed", message: String(e) });
    }
  }

  async function deleteTemplate(template: Template) {
    const confirmed = await confirmAlert({
      title: `Delete "${template.name}"?`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    const updated = templates.filter((t) => t.id !== template.id);
    await saveTemplates(updated);
    setTemplates(updated);
    await showToast({ style: Toast.Style.Success, title: "Template deleted" });
  }

  const newTemplateAction = (
    <Action
      title="New Template"
      shortcut={{ modifiers: ["cmd"], key: "n" }}
      onAction={() => push(<NewTemplateForm onSave={refresh} />)}
    />
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search templates...">
      {templates.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No templates yet"
          description="Press ⌘N to save your first Notion block template"
          actions={<ActionPanel>{newTemplateAction}</ActionPanel>}
        />
      ) : (
        templates.map((template) => (
          <List.Item
            key={template.id}
            title={template.name}
            subtitle={template.preview.slice(0, 60)}
            actions={
              <ActionPanel>
                <Action title="Paste Template" onAction={() => pasteTemplate(template)} />
                {newTemplateAction}
                <Action
                  title="Delete Template"
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["ctrl"], key: "x" }}
                  onAction={() => deleteTemplate(template)}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
