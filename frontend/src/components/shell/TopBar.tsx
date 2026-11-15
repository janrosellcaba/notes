import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Search, Settings } from "lucide-react";

import { getMe, logout } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useUi } from "../../stores/ui";
import { BrandMark } from "../ui/BrandMark";
import { Kbd } from "../ui/Kbd";
import { Popover } from "../ui/Popover";
import { ContextSwitcher } from "./ContextSwitcher";

export function TopBar() {
  const [accountOpen, setAccountOpen] = useState(false);
  const setPaletteOpen = useUi((state) => state.setPaletteOpen);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: getMe });
  const initial = (me.data?.username ?? "?").slice(0, 1).toUpperCase();

  async function signOut() {
    setAccountOpen(false);
    await logout();
    queryClient.clear();
    void navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-elevated px-3 md:px-4">
      <Link to="/" className="mr-1 flex shrink-0 items-center gap-2 text-[14px] font-medium">
        <BrandMark size={28} />
        Notes
      </Link>
      <ContextSwitcher />
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-border bg-canvas px-2 text-[13px] text-fg-muted hover:border-border-strong hover:text-fg md:w-56 md:px-2.5"
          onClick={() => setPaletteOpen(true)}
        >
          <Search size={14} />
          <span className="hidden flex-1 text-left md:inline">Search</span>
          <span className="hidden rounded-[5px] border border-border-subtle px-1 py-px md:inline">
            <Kbd>K</Kbd>
          </span>
        </button>
        <Popover
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          className="right-0"
          trigger={
            <button
              type="button"
              aria-label="Account"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-canvas text-[13px] font-medium hover:bg-interactive"
              onClick={() => setAccountOpen((value) => !value)}
            >
              {initial}
            </button>
          }
        >
          <div className="flex min-w-44 flex-col">
            <p className="px-3 py-2 text-[13px] text-fg-muted">{me.data?.username ?? "Account"}</p>
            <Link
              to="/settings"
              className="flex min-h-11 items-center gap-2 rounded-[8px] px-3 hover:bg-interactive"
              onClick={() => setAccountOpen(false)}
            >
              <Settings size={16} />
              Settings
            </Link>
            <button
              type="button"
              className="flex min-h-11 items-center gap-2 rounded-[8px] px-3 text-left hover:bg-interactive"
              onClick={() => void signOut()}
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </Popover>
      </div>
    </header>
  );
}
