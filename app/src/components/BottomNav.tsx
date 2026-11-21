import React from "react";
import { Plus, Home, Table, CreditCard, Users } from "lucide-react";

export type NavTab = "activity" | "sheet" | "settle" | "members";

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenAddModal: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenAddModal,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto pointer-events-none px-4 pb-4 md:hidden">
      <div className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-[#e5e5e7] rounded-full p-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] flex items-center justify-between">
        {/* Tab 1: Activity */}
        <button
          onClick={() => onChangeTab("activity")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 ${
            activeTab === "activity"
              ? "text-[#0066cc]"
              : "text-[#86868b] hover:text-[#1d1d1f]"
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight">Home</span>
        </button>

        {/* Tab 2: Sheet */}
        <button
          onClick={() => onChangeTab("sheet")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 ${
            activeTab === "sheet"
              ? "text-[#0066cc]"
              : "text-[#86868b] hover:text-[#1d1d1f]"
          }`}
        >
          <Table className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight">Sheet</span>
        </button>

        {/* Center Raised Action Button: + Add */}
        <div className="px-1 -mt-5">
          <button
            onClick={onOpenAddModal}
            className="w-13 h-13 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white flex items-center justify-center shadow-[0_6px_20px_rgba(0,102,204,0.45)] active:scale-90 transition-transform duration-150 border-3 border-white cursor-pointer"
            title="Add Expense"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 3: Settle */}
        <button
          onClick={() => onChangeTab("settle")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 ${
            activeTab === "settle"
              ? "text-[#0066cc]"
              : "text-[#86868b] hover:text-[#1d1d1f]"
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight">Settle</span>
        </button>

        {/* Tab 4: Members */}
        <button
          onClick={() => onChangeTab("members")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-95 ${
            activeTab === "members"
              ? "text-[#0066cc]"
              : "text-[#86868b] hover:text-[#1d1d1f]"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight">Mates</span>
        </button>
      </div>
    </div>
  );
};
