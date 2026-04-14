import { List, ActionPanel, Action, showToast, Toast, LocalStorage, Clipboard } from "@raycast/api";
import { useEffect, useState } from "react";

interface Template {
  id: string;
  name: string;
  html: string;
  text: string;
}

export default function Command() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const stored = await LocalStorage.getItem<string>("templates");
    if (stored) {
      setTemplates(JSON.parse(stored));
    }
    setIsLoading(false);
  }

  async function pasteTemplate(template: Template) {
    await Clipboard.paste({ html: template.html, text: template.text });
    await showToast({ style: Toast.Style.Success, title: `Pasted "${template.name}"` });
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search templates...">
      {templates.map((template) => (
        <List.Item
          key={template.id}
          title={template.name}
          actions={
            <ActionPanel>
              <Action title="Paste Template" onAction={() => pasteTemplate(template)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
