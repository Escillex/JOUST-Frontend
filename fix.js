const fs = require('fs');
let code = fs.readFileSync('app/components/tournaments/manage/CreateTournamentForm.tsx', 'utf8');

const target1 = `          </div>
        </div>
      </div>

      {(format === "SWISS" || format === "HYBRID") && (
        <div className="pt-6 border-t border-white/10">`;

const replace1 = `          </div>
        </div>
      </div>

      <details className="pt-6 border-t border-white/10 group">
        <summary className="text-xs font-semibold text-white/40 uppercase tracking-widest cursor-pointer select-none list-none flex items-center gap-2 transition-colors hover:text-white/60 mb-6">
          <span className="group-open:rotate-90 transition-transform text-[8px] opacity-70">▶</span>
          Advanced Format Settings
        </summary>
        <div className="space-y-8 animate-in slide-in-from-top-2 duration-300">

      {(format === "SWISS" || format === "HYBRID") && (
        <div className="pt-6 border-t border-white/10">`;

if (code.includes(target1)) {
  code = code.replace(target1, replace1);
  console.log("Replaced target1");
} else {
  console.error("Could not find target1");
}

const target2 = `        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-[#888888]">Match length and draw</h4>`;

const replace2 = `      </div>

      <details className="pt-6 border-t border-white/10 group">
        <summary className="text-xs font-semibold text-white/40 uppercase tracking-widest cursor-pointer select-none list-none flex items-center gap-2 transition-colors hover:text-white/60 mb-6">
          <span className="group-open:rotate-90 transition-transform text-[8px] opacity-70">▶</span>
          Advanced Format Settings
        </summary>
        <div className="space-y-8 animate-in slide-in-from-top-2 duration-300">

        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-[#888888]">Match length and draw</h4>`;

// Actually, wait, let me look at the target file. It's much simpler. I can just do:

const splitStr = `
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-[#888888]">Match length and draw</h4>`;

const parts = code.split(splitStr);
if (parts.length === 2) {
  // Before splitStr, there's `          </div>\n        </div>\n` which is the left column.
  // We want to insert `      </div>` to close the grid, then details.
  const before = parts[0] + `      </div>\n\n      <details className="pt-6 border-t border-white/10 group">\n        <summary className="text-xs font-semibold text-white/40 uppercase tracking-widest cursor-pointer select-none list-none flex items-center gap-2 transition-colors hover:text-white/60 mb-6">\n          <span className="group-open:rotate-90 transition-transform text-[8px] opacity-70">▶</span>\n          Advanced Format Settings\n        </summary>\n        <div className="space-y-8 animate-in slide-in-from-top-2 duration-300">\n`;
  
  const endSplit = `          </Field>\n        </div>\n      </div>\n    </div>\n  );\n\n  const renderSchedule = () => (`;
  
  let rest = splitStr + parts[1];
  
  // Also we need to remove the grid closing div which was at the end of Match length and draw section!
  // It looks like:
  //               </p>
  //             </Field>
  //           </div>
  //         </div>
  //       </div>
  //
  //       {(format === "SWISS" || format === "HYBRID") && (
  
  rest = rest.replace(`              </p>
            </Field>
          </div>
        </div>
      </div>

      {(format === "SWISS" || format === "HYBRID") && (`, `              </p>
            </Field>
          </div>
        </div>

      {(format === "SWISS" || format === "HYBRID") && (`);
      
  rest = rest.replace(endSplit, `          </Field>\n        </div>\n      </div>\n      </div>\n      </details>\n    </div>\n  );\n\n  const renderSchedule = () => (`);
  
  fs.writeFileSync('app/components/tournaments/manage/CreateTournamentForm.tsx', before + rest);
  console.log("Success");
} else {
  console.log("splitStr not found");
}
