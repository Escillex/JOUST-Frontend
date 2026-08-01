"use client";
import { useState } from "react";
import { Tournament, FormatConfig, TournamentTemplate, ConfigField } from "../../../tournaments/types";
import { getTrackerSettings } from "../../../utils/formatConfig";

const inputCls = "w-full h-10 bg-background border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-primary transition-colors rounded";

interface Props {
  tournament: Tournament;
  formatDefinitions: any[];
  isEditing: boolean;
  formatConfig: FormatConfig;
  onToggleEdit: () => void;
  onDiscard: () => void;
  onRuleChange: (key: string, value: any) => void;
  onSave: () => void;
}

// The API now states each field's `type` outright. The key-name checks are kept
// as a fallback so the panel still works against an older server that serves
// the catalog without it.
function isBooleanField(field: ConfigField) {
  return (
    field.type === "boolean" ||
    field.key === "allowDraw" ||
    typeof field.defaultValue === "boolean"
  );
}

function isArrayField(field: ConfigField) {
  return field.type === "array" || field.key === "tieBreakerOrder";
}

function isSelectField(field: ConfigField) {
  return field.type === "select" && Array.isArray(field.options);
}

function isStringField(field: ConfigField) {
  return (
    isArrayField(field) ||
    field.type === "string" ||
    field.key === "progressionType"
  );
}

function getDisplayValue(field: ConfigField, formatConfig: FormatConfig) {
  const rawValue = (formatConfig as any)[field.key];
  if (isBooleanField(field)) {
    return rawValue === true ? "Yes" : rawValue === false ? "No" : field.defaultValue === true ? "Yes" : "No";
  }
  if (isArrayField(field)) {
    return Array.isArray(rawValue) ? rawValue.join(", ") : field.defaultValue ?? "AUTO";
  }
  return rawValue ?? field.defaultValue ?? "AUTO";
}

export default function FormatRulesPanel({ 
  tournament, 
  formatDefinitions, 
  isEditing, 
  formatConfig, 
  onToggleEdit, 
  onDiscard, 
  onRuleChange, 
  onSave
}: Props) {
  const fields: ConfigField[] =
    formatDefinitions.find((f) => f.id === tournament.formatId)?.configFields ?? [];
  const hasFormat = !!tournament.formatId;
  const tracker = getTrackerSettings(formatConfig);

  const handleChange = (field: ConfigField, rawValue: string | boolean) => {
    if (isBooleanField(field)) {
      onRuleChange(field.key, Boolean(rawValue));
      return;
    }

    if (isArrayField(field)) {
      const text = String(rawValue).trim();
      if (text === "") {
        onRuleChange(field.key, null);
      } else {
        const items = text
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        onRuleChange(field.key, items.length > 0 ? items : null);
      }
      return;
    }

    if (isStringField(field)) {
      const text = String(rawValue).trim();
      onRuleChange(field.key, text === "" ? null : text);
      return;
    }

    const value = String(rawValue).trim();
    onRuleChange(field.key, value === "" ? null : Number(value));
  };

  return (
    <div className="bg-[#000000] border border-white/20 p-4 md:p-6 rounded">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-white">Match & Scoring Rules</h3>
          {!isEditing && (
            <button onClick={onToggleEdit} className="text-primary hover:text-white transition-colors p-1.5 bg-primary/10 rounded">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
        {isEditing && (
          <button onClick={onDiscard} className="text-xs font-semibold text-[#FF4D4D] hover:text-[#FF4D4D]/80 transition-colors">Discard</button>
        )}
      </div>

      {!hasFormat ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/20 rounded bg-transparent">
          <p className="text-sm text-[#888888] text-center">
            Select a Format Preset to configure match rules.
          </p>
        </div>
      ) : isEditing ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => {
              const rawValue = (formatConfig as any)[field.key];
              const value = isArrayField(field)
                ? Array.isArray(rawValue)
                  ? rawValue.join(", ")
                  : ""
                : rawValue ?? "";

              return (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-semibold text-[#888888] block">{field.label}</label>
                  {field.key === "allowDraw" ? (
                    <div className="flex gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => handleChange(field, false)}
                        className={`flex-1 h-10 text-xs font-semibold border transition-colors rounded ${
                          !rawValue
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-white/20 text-[#888888] hover:text-white"
                        }`}
                      >
                        Force Win
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange(field, true)}
                        className={`flex-1 h-10 text-xs font-semibold border transition-colors rounded ${
                          rawValue
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-white/20 text-[#888888] hover:text-white"
                        }`}
                      >
                        Permit Draws
                      </button>
                    </div>
                  ) : isBooleanField(field) ? (
                    <label className="flex items-center gap-3 cursor-pointer group py-2">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${Boolean(rawValue) ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary"}`}>
                        {Boolean(rawValue) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(rawValue)}
                        onChange={(e) => handleChange(field, e.target.checked)}
                        className="hidden"
                      />
                      <span className="text-sm text-[#E0E0E0]">{Boolean(rawValue) ? "Enabled" : "Disabled"}</span>
                    </label>
                  ) : isSelectField(field) ? (
                    <select
                      value={String(rawValue ?? field.defaultValue ?? "")}
                      onChange={(e) => handleChange(field, e.target.value)}
                      className={inputCls}
                    >
                      {field.options!.map((opt) => (
                        <option key={opt} value={opt} className="bg-background">
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={isStringField(field) ? "text" : "number"}
                      value={value}
                      onChange={(e) => handleChange(field, e.target.value)}
                      placeholder={field.defaultValue !== null && field.defaultValue !== undefined ? String(field.defaultValue) : field.placeholder}
                      min={field.min}
                      max={field.max}
                      className={inputCls}
                    />
                  )}
                  {field.help && (
                    <p className="text-[11px] text-[#888888] leading-relaxed">{field.help}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center space-x-3">
              <input 
                type="checkbox" 
                id="enableHpSystem" 
                checked={!!formatConfig?.startingHp} 
                onChange={e => {
                  const checked = e.target.checked;
                  onRuleChange('startingHp', checked ? 100 : 0);
                }} 
                className="w-4 h-4 cursor-pointer accent-primary" 
              />
              <label htmlFor="enableHpSystem" className="text-sm text-white cursor-pointer select-none">HP-Based Match System</label>
            </div>
            {!!formatConfig?.startingHp && (
              <div className="space-y-1 max-w-xs pl-7">
                <label className="text-xs font-semibold text-[#888888] block">Starting HP</label>
                <input 
                  type="number" 
                  value={formatConfig.startingHp} 
                  onChange={e => onRuleChange('startingHp', Math.max(1, Number(e.target.value)))} 
                  min={1}
                  className={inputCls} 
                />
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-white/10">
            <button onClick={onSave} className="flex-1 h-10 bg-primary text-black font-semibold text-sm rounded hover:brightness-90 transition-colors">
              Save Rules
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-4">
          {fields.map((field: any) => (
            <div key={field.key} className="space-y-1">
              <p className="text-xs font-semibold text-[#888888]">{field.label}</p>
              <p className="text-sm text-white">
                {getDisplayValue(field, formatConfig)}
              </p>
            </div>
          ))}
          {fields.length === 0 && (
            <p className="col-span-full text-sm text-[#888888] italic">No specific config for this format</p>
          )}
          <div className="col-span-full border-t border-white/10 pt-4 grid grid-cols-2 gap-y-4 gap-x-4">
            {/* Derived, not read off the config: these three are outputs of the
                backend's resolveConfig and are never stored, so reading them
                directly always produced undefined and the fallbacks below
                reported the opposite of the truth (plan 9.7). */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#888888]">Tracking Mode</p>
              <p className="text-sm text-white">{tracker.trackingMode}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#888888]">Starting Value</p>
              <p className="text-sm text-white">
                {tracker.defaultStartingValue ?? `Auto (${formatConfig?.bestOf ?? 1} wins)`}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#888888]">Live Tracker</p>
              <p className="text-sm text-white">{tracker.useTracker ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
