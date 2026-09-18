"use client";

import React, { useState, useRef, useEffect } from "react";

interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  disabled = false,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update search text when value changes from outside (or when closing)
  const selectedOption = options.find((o) => o.value === value);
  useEffect(() => {
    if (!isOpen) {
      setSearch(selectedOption ? selectedOption.label : "");
    }
  }, [value, isOpen, selectedOption]);

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <input
        type="text"
        value={isOpen ? search : selectedOption ? selectedOption.label : ""}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setSearch(""); // Clear on focus for easy typing
          setIsOpen(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-10 bg-background border border-white/20 px-3 pr-10 text-sm text-white focus:outline-none focus:border-primary transition-colors rounded placeholder:text-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      
      {/* Down chevron to make it look like a select */}
      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/50">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#1A1A1A] border border-white/20 rounded shadow-xl max-h-60 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[#888888]">No matches found</div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/10 ${
                  opt.value === value ? "bg-primary/10 text-primary font-semibold" : "text-white"
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
