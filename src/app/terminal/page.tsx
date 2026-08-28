import { TerminalExperience } from "@/components/terminal/terminal-experience";
import { TerminalLanguageProvider } from "@/hooks/use-terminal-language";
import { getCatalog } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";

// Always render fresh — catalog/stock and settings change at runtime.
export const dynamic = "force-dynamic";

export default function TerminalPage() {
  const catalog = getCatalog();
  const settings = getSettings();

  return (
    <TerminalLanguageProvider>
      <TerminalExperience
        cafeName={settings.cafe_name ?? "Cafe Herzlich"}
        paypalHandle={settings.paypal_handle ?? null}
        initialCatalog={catalog}
      />
    </TerminalLanguageProvider>
  );
}
