import {
  List,
  ActionPanel,
  Action,
  Form,
  showToast,
  Toast,
  LocalStorage,
  Clipboard,
  useNavigation,
  confirmAlert,
  Alert,
} from "@raycast/api";
import { useEffect, useState } from "react";

interface Template {
  id: string;
  name: string;
  html: string;
  text: string;
}

const STORAGE_KEY = "templates";

async function loadTemplates(): Promise<Template[]> {
  const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function saveTemplates(templates: Template[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

// --- New Template Form ---

function NewTemplateForm({ onSave }: { onSave: () => void }) {
  const { pop } = useNavigation();
  const [name, setName] = useState("");
  const [captured, setCaptured] = useState<{ html: string; text: string } | null>(null);

  async function captureClipboard() {
    const content = await Clipboard.read();
    if (!content.html) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No HTML content on clipboard",
        message: "Copy a Notion block first, then try again.",
      });
      return;
    }
    setCaptured({ html: content.html, text: content.text ?? "" });
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
      html: captured.html,
      text: captured.text,
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
      <Form.TextField id="name" title="Name" placeholder="e.g. Meeting notes header" value={name} onChange={setName} />
      <Form.Description
        title="Clipboard"
        text={captured ? `Ready — "${captured.text.slice(0, 60).trim()}${captured.text.length > 60 ? "…" : ""}"` : "Not captured yet. Copy a Notion block, then press ⌘V."}
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
    await Clipboard.paste({ html: template.html, text: template.text });
    await showToast({ style: Toast.Style.Success, title: `Pasted "${template.name}"` });
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
