/**
 * An implementation of `CoqEditor` for CodeMirror 5.
 */
import CodeMirror from "codemirror";
import { ProviderContainer } from "./cm-provider-container";
import { ICoqEditor } from "./coq-editor";

/** Interface for CM5 */
export class CoqCodeMirror5 extends ProviderContainer implements ICoqEditor {
    private version : number;
    private company_coq : any;

    constructor(elementRefs, onChange, diagsSource, options, manager) {

        super(elementRefs, options, manager);

        this.options = options;
        this.manager = manager;
        this.version = 1;

        this.onChange = () => {
            let txt = this.getValue();
            this.version++;
            this.onChange(txt, this.version);
        };

        diagsSource.addEventListener('clear', (e) => {
            this.clearMarks();
        });

        diagsSource.addEventListener('diags', (e) => {
            let { diags, version } = e.detail;
            if (version == this.version) {
                for (let d of diags)
                    this.markDiagnostic(d);
            }
        });

        CoqCodeMirror5._set_keymap();
    }

    getCursorOffset() {
        /** @todo need to get the focused one and add the offset of the ones above it */
        return this.snippets[0].getCursorOffset();
    }

    // To be overriden by the manager
    getValue() {
        return this.snippets.map(part => part.getValue()).join('\n');
    }

    clearMarks() {
        for (let part of this.snippets)
            part.retract();
    }

    markDiagnostic(diag) {
        console.log(diag);
        // Find the part that contains the target line
        let ln = 0, start_ln = diag.range.start.line, in_part = undefined;
        for (let part of this.snippets) {
            let nlines = part.editor.lineCount();
            if (start_ln >= ln && start_ln < ln + nlines) {
                in_part = part;
                break;
            }
            else {
                ln += nlines;
            }
        }
        // Adjust the mark for the line offset
        diag.range.start.line -= ln;
        diag.range.end_.line -= ln;
        in_part.mark(diag);

    }

    static _set_keymap() {

        CodeMirror.keyMap['jscoq'] = {
            'Tab': 'indentMore',
            'Shift-Tab': 'indentLess',
            'Ctrl-Space': 'autocomplete',
            fallthrough: ["default"]
        };

        CodeMirror.keyMap['jscoq-snippet'] = {
            PageUp: false,
            PageDown: false,
            //'Cmd-Up': false,   /** @todo this does not work? */
            //'Cmd-Down': false
        };
    }
}

// Local Variables:
// js-indent-level: 4
// End:
