// CodeMirror implementation
// CodeMirror
import CodeMirror from 'codemirror';
import 'codemirror/addon/hint/show-hint.js';
import 'codemirror/addon/edit/matchbrackets.js';
import 'codemirror/keymap/emacs.js';
import 'codemirror/addon/selection/mark-selection.js';
import 'codemirror/addon/edit/matchbrackets.js';
import 'codemirror/addon/dialog/dialog.js';

// CM medias
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/blackboard.css';
import 'codemirror/theme/darcula.css';
import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/dialog/dialog.css';

import '../external/CodeMirror-TeX-input/addon/hint/tex-input-hint.js';
import './mode/coq-mode.js';
import { CmCoqProvider } from './cm-provider.js';
import { CompanyCoq } from './addon/company-coq.js';

export class CoqCodeMirror5 extends CmCoqProvider {
    version : number;
    cm : CmCoqProvider;
    options : any;
    manager : any;

    constructor(eIds, options, manager) {
        CoqCodeMirror5._set_keymap();
        let element = document.getElementById(eIds[0]);
        super(element, options, false, 0);
        this.version = 1;
        this.manager = manager;
        this.editor.on('change', (editor, change) => {
            let txt = this.getValue();
            this.version++;
            this.onChange(this.editor, txt, this.version);
        });
        if (this.options.mode && this.options.mode['company-coq']) {
            this.company_coq = new CompanyCoq(this.manager);
            this.company_coq.attach(this.editor);
        }
    }

    // To be overriden by the manager
    getValue() {
        return this.editor.getValue();
    }

    clearMarks() {
        for (let m of this.editor.getAllMarks()) {
            m.clear();
        }
    }

    markDiagnostic(d, version) {

        var from = { line: d.range.start.line, ch: d.range.start.character };
        var to = { line: d.range._end.line, ch: d.range._end.character };

        var doc = this.editor.getDoc();
        var mclass = (d.severity === 1) ? 'coq-eval-failed' : 'coq-eval-ok';

        doc.markText(from, to, {className: mclass});
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
    getCursorOffset() {
        return this.editor.getDoc().indexFromPos(this.editor.getCursor());
    }    
}

// Local Variables:
// js-indent-level: 4
// End:
