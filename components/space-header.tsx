import { Avatar, initial, memberTone } from "@/components/avatar";
import { Pressable } from "@/components/item-visuals";

// Topo do início (mockups 21/50): "JUNTOS", nome do espaço e as bolinhas do casal.
// Mesmo componente no app e na demo.
export function SpaceHeader({
  name,
  memberNames,
  waiting = false,
}: {
  name: string;
  memberNames: string[];
  // Sem par ainda: bolinha tracejada "?".
  waiting?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cream/60">
          Juntos
        </p>
        <h1 className="mt-1 text-[28px] font-medium leading-tight text-cream">
          {name}
        </h1>
      </div>
      <div aria-hidden="true" className="flex shrink-0 -space-x-2">
        {memberNames.map((memberName, index) => (
          <Avatar
            key={index}
            label={initial(memberName)}
            size="md"
            tone={memberTone(index)}
          />
        ))}
        {waiting ? (
          <Avatar label="?" size="md" dashed className="bg-background" />
        ) : null}
      </div>
    </div>
  );
}

type NavAction = { href?: string; onClick?: () => void };

const NAV_TEXT =
  "flex h-11 items-center rounded-full px-2.5 transition hover:text-cream";

// Barra discreta do topo: "Lista" · "+" · "Ajustes" (links no app, botões na demo).
export function TopNav({
  list,
  add,
  settings,
}: {
  list: NavAction;
  add: NavAction;
  settings: NavAction;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      data-topnav=""
      className="mx-auto flex w-full max-w-lg items-center justify-end gap-1 text-[13px] font-semibold text-cream/60 md:max-w-3xl lg:max-w-6xl"
    >
      <Pressable {...list} className={NAV_TEXT}>
        Lista
      </Pressable>
      <Pressable
        {...add}
        aria-label="Nova ideia"
        className="group flex h-11 w-11 items-center justify-center rounded-full transition hover:text-cream"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-cream/25 text-lg leading-none transition group-hover:border-cream/50"
        >
          +
        </span>
      </Pressable>
      <Pressable {...settings} className={NAV_TEXT}>
        Ajustes
      </Pressable>
    </nav>
  );
}
