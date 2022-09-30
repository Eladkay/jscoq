/**
 * An implementation of `CoqEditor` for CodeMirror 5.
 */
import CodeMirror from "codemirror";
import { ProviderContainer } from "./cm-provider-container";
import { CompanyCoq } from "./addon/company-coq";

/** Interface for CM5 */
export class CoqCodeMirror5 extends ProviderContainer {
    version : number;
    manager : any;
    company_coq : any;

    /**
     *
     * @param {(string | HTMLElement)[]} elementRefs
     * @param {object} options
     * @param {CoqManager} manager
     */
    constructor(elementRefs, options, manager) {

        super(elementRefs, options);

        this.manager = manager;
        this.version = 1;

        this.onChange = () => {
            let txt = this.getValue();
            this.version++;
<<<<<<< HEAD
            this.onChange(this.editor, txt, this.version);
        });
=======
            this.onChange(txt, this.version);
        };

>>>>>>> 185bba6 ([feature] Resurrected ProviderContainer.)
        if (this.options.mode && this.options.mode['company-coq']) {
            this.company_coq = new CompanyCoq(this.manager);
            this.company_coq.attach(this.editor);
        }

        CoqCodeMirror5.set_keymap();
    }

    getCursorOffset() {
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

<<<<<<< HEAD
    markDiagnostic(d, version) {

        var from = { line: d.range.start.line, ch: d.range.start.character };
        var to = { line: d.range._end.line, ch: d.range._end.character };

        var doc = this.editor.getDoc();
        var mclass = (d.severity === 1) ? 'coq-eval-failed' : 'coq-eval-ok';

        doc.markText(from, to, {className: mclass});
=======
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
        diag.range._end.line -= ln;
        in_part.mark(diag);
>>>>>>> 185bba6 ([feature] Resurrected ProviderContainer.)
    }

    _set_keymap() {

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
<<<<<<< HEAD
    getCursorOffset() {
        return this.editor.getDoc().indexFromPos(this.editor.getCursor());
    }    
=======
>>>>>>> 185bba6 ([feature] Resurrected ProviderContainer.)
}

// Local Variables:
// js-indent-level: 4
// End:
