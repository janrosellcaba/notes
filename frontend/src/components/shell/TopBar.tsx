import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Search } from "lucide-react";

import { logout } from "../../lib/api";
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
          className="inline-flex min-h-11 items-center gap-2 rounded-[8px] px-2 hover:bg-interactive"
          onClick={() => setPaletteOpen(true)}
        >
          <Search size={18} />
          <span className="hidden md:inline">Search</span>
          <span className="hidden md:inline">
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
              className="inline-flex min-h-11 items-center rounded-[8px] px-3 hover:bg-interactive"
              onClick={() => setAccountOpen((value) => !value)}
            >
              Account
            </button>
          }
        >
          <div className="flex min-w-40 flex-col">
            <Link
              to="/settings"
              className="flex min-h-11 items-center rounded-[8px] px-3 hover:bg-interactive"
              onClick={() => setAccountOpen(false)}
            >
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
