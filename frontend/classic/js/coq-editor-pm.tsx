// Prosemirror implementation
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
import { EditorState, Plugin } from 'prosemirror-state';
import { schema, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { exampleSetup } from 'prosemirror-example-setup';
import { Fragment, DOMSerializer } from 'prosemirror-model';

import { createStore as createReduxStore, applyMiddleware } from 'redux';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-menu/style/menu.css';
import 'prosemirror-example-setup/style/style.css';

import 'codemirror/lib/codemirror.css';
import 'sidenotes/dist/sidenotes.css';
import '@curvenote/components/dist/curvenote';
import '@curvenote/editor/dist/editor.css';

import './mode/coq-mode-cn.js';

import { Provider } from 'react-redux';

// Curvenote editor
import { toHTML, toMarkdown, toTex, ReferenceKind, process, toText, fromMarkdown, schemas } from '@curvenote/schema';
import { Editor, Store, EditorMenu, InlineActions, Options, LinkResult, actions, setup, Suggestions, Attributes, SuggestionSwitch } from '@curvenote/editor';
import InlineActionSwitch from '@curvenote/editor/dist/src/components/InlineActions/Switch';

import rootReducer from './cn-reducer';
import middleware from './cn-middleware';

// import { InlineActionSwitch } from '@curvenote/editor';

import { Sidenote, AnchorBase } from 'sidenotes';

// import { editorAppend } from './coq-editor.js';
import { ICoqEditor } from './coq-editor-cm6.js';

import { createTheme, Button } from '@material-ui/core';

function diagNew(d) {
    var mark_class = (d.severity === 1) ? 'coq-eval-failed' : 'coq-eval-ok';
    return Decoration.inline(d.range.start.offset + 1, d.range.end_.offset + 1, { class: mark_class });
}

// Implementation of Asynchronous diagnostics
//
// We use two transactions: `clear` to clear the diagnostics, and
// regular one that will just append to the DecorationSet.
//
// An interesting side-effect of cur.add taking a `doc` is that it is
// possible to have a race condition where a diagnostic transaction
// will revert a user-initiated one. We solve this with a guard on
// document versions. CM 6 doesn't see to suffer from this problem.
//
// The two entry points are:
//
// - onChange: this will notify the user the document has changed so
//   the linter can be called
// - markDiagnostic: used by the linter to notify a new diagnostic
// - clearMarks: clear all diagnostics, we put the logic in the user (for now)
let coqDiags = new Plugin({
    props: {
        decorations(st) {
            return this.getState(st);
        }
    },
    state: {
        init(_config,_instance) { return DecorationSet.empty },
        apply(tr, cur) {
            var d = tr.getMeta(coqDiags);
            if (d) {
                if(d === "clear") {
                    return DecorationSet.empty;
                } else {
                    return cur.add(tr.doc, [d])
                }
            } else {
                return cur.map(tr.mapping, tr.doc);
            }
        }
    }
})

const stateKey = 'myEditor';
const viewId1 = 'view1';
const docId = 'jsCoqDemo';
const someLinks: LinkResult[] = [
    {
      kind: ReferenceKind.cite,
      uid: 'simpeg2015',
      label: 'simpeg',
      content: 'Cockett et al., 2015',
      title:
        'SimPEG: An open source framework for simulation and gradient based parameter estimation in geophysical applications.',
    },
    {
      kind: ReferenceKind.link,
      uid: 'https://curvenote.com',
      label: null,
      content: 'Curvenote',
      title: 'Move ideas forward',
    },
  ];

declare global {
    interface Window {
      [index: string]: any;
    }
  }

export function createStore(): Store {
    return createReduxStore(rootReducer, applyMiddleware(...middleware));
  }
/*   this.view =
  new EditorView(container, {
      state: EditorState.create({
          doc: doc,
          plugins: [...exampleSetup({schema: schema}), coqDiags]
      }),
      // We update the text area
      dispatchTransaction(tr) {
          // Update textarea only if content has changed
          if (tr.docChanged) {

              // We update the version!
              pm.version++;

              let newDoc = CoqProseMirror.serializeDoc(tr.doc);
              pm.onChangeRev(newDoc, pm.version);

              var newMarkdown = defaultMarkdownSerializer.serialize(tr.doc);
              area.value = newMarkdown;
          }

          const { state } = this.state.applyTransaction(tr);
          this.updateState(state);
      },
  });

this.view.focus(); */
function JsCoqEditor( { content, store = createStore(), onChange, diagsSource }) {
 
    const [reduxStore, setStore] = useState<Store | null>(null);
    const [{ newCommentFn, removeCommentFn }, setFn] = useState<any>({
        newCommentFn: null,
        removeCommentFn: null,
      });

    useEffect(() => {
        if (reduxStore) return;
        const theme = createTheme({});
        const newComment = () => {
            store?.dispatch(actions.addCommentToSelectedView('sidenote1'));
        };
        const removeComment = () => {
            store?.dispatch(actions.removeComment(viewId1, 'sidenote1'));
        };
        const opts: Options = {
            transformKeyToId: (key) => key,
            uploadImage: async (file) => {
            // eslint-disable-next-line no-console
            console.log(file);
            return new Promise((resolve) =>
                setTimeout(() => resolve('https://curvenote.dev/images/logo.png'), 2000),
                );
            },
            addComment() {
                newComment();
                return true;
            },
            onDoubleClick(stateId, viewId) {
                // eslint-disable-next-line no-console
                console.log('Double click', stateId, viewId);
                return false;
            },
            getDocId() {
                return docId;
            },
            theme,
            citationPrompt: async () => [
                {
                key: 'simpeg2015',
                kind: ReferenceKind.cite,
                text: 'Cockett et al, 2015',
                label: 'simpeg',
                title: '',
                },
            ],
            createLinkSearch: async () => ({ search: () => someLinks }),
            getCaptionFragment: (schema) => Fragment.fromArray([schema.text('Hello caption world!')]),
            nodeViews: {},
        };
        setup(store, opts);
        window.store = store;
        store.dispatch(actions.initEditorState('full', stateKey, true, content, 0));
        store.subscribe(() => {
        const myst = document.getElementById('myst');
        const text = document.getElementById('text');
        const tex = document.getElementById('tex');
        const html = document.getElementById('html');
        const editor = store.getState().editor.state.editors[stateKey];
        if (myst) {
            try {
            myst.innerText = toMarkdown(editor.state.doc);
            } catch (e) {
            myst.innerText = 'Error converting to markdown';
            }
        }
        if (tex) {
            try {
            tex.innerText = toTex(editor.state.doc);
            } catch (error) {
            tex.innerText = 'There was an error :(';
            }
        }
        if (text) {
            try {
            text.innerText = toText(editor.state.doc);
            } catch (error) {
            text.innerText = 'There was an error :(';
            }
        }
        if (html) {
            html.innerText = toHTML(editor.state.doc, editor.state.schema, document);
        }
        // Update the counter
        const counts = process.countState(editor.state);
        const words = process.countWords(editor.state);
        const updates = {
            'count-sec': `${counts.sec.all.length} (${counts.sec.total})`,
            'count-fig': `${counts.fig.all.length} (${counts.fig.total})`,
            'count-eq': `${counts.eq.all.length} (${counts.eq.total})`,
            'count-code': `${counts.code.all.length} (${counts.code.total})`,
            'count-table': `${counts.table.all.length} (${counts.table.total})`,
            'count-words': `${words.words}`,
            'count-char': `${words.characters_including_spaces}  (${words.characters_excluding_spaces})`,
        };
        Object.entries(updates).forEach(([key, count]) => {
            const el = document.getElementById(key);
            if (el) el.innerText = count;
        });
        });
        setStore(store);
        setFn({ newCommentFn: newComment, removeCommentFn: removeComment });
    }, [ content, reduxStore, store ]);

    if (!reduxStore || !newCommentFn || !removeCommentFn) return <div>Setting up editor ...</div>;

    return (
        <Provider store={reduxStore}>
          <React.StrictMode>
             <EditorMenu standAlone />
             <InlineActions>
                <InlineActionSwitch />
            </InlineActions>
                <article id={docId} className="content centered">
                <AnchorBase anchor="anchor">
                    <div className="selected">
                    <Editor stateKey={stateKey} viewId={viewId1} />
                    </div>
                </AnchorBase>
                {/* <Editor stateKey={stateKey} viewId="two" /> */}
                <div className="sidenotes">
                    <Sidenote sidenote="sidenote1" base="anchor">
                    <div style={{ width: 280, height: 100, backgroundColor: 'green' }} />
                    </Sidenote>
                    <Sidenote sidenote="sidenote2" base="anchor">
                    <div style={{ width: 280, height: 100, backgroundColor: 'red' }} />
                    </Sidenote>
                </div>
            </article>
            <div className="centered">
          <p>
            Select some text to create an inline comment (cmd-opt-m). See
            <a href="https://curvenote.com"> curvenote.com </a>
            for full demo.
          </p>
            <Button onClick={newCommentFn}>Comment</Button>
            <Button onClick={removeCommentFn}>Remove</Button>
            </div>
        <Suggestions>
          <SuggestionSwitch />
        </Suggestions>
        <Attributes />
        </React.StrictMode>
      </Provider>
    )
}
export class CoqProseMirror implements ICoqEditor {

    /**
     * Initializes a Prosemirror isntance given the areaID
     */
     constructor(elems : string | string[], onChange, diagsSource) {

        let areaId = (typeof elems === "string") ? elems : elems[0];

        let area : HTMLTextAreaElement = document.getElementById(areaId) as HTMLTextAreaElement;
        area.style.display = 'none';
        const container = document.createElement('div');

        container.setAttribute('spellCheck', "false");
        container.classList.add(...area.classList);

        if (area.nextSibling) {
            area.parentElement.insertBefore(container, area.nextSibling);
        } else {
            area.parentElement.appendChild(container);
        }

        var doc = fromMarkdown(area.value, 'full' );
        var doc_json = JSON.stringify(doc.toJSON());

        console.log(doc);
        ReactDOM.render(<JsCoqEditor content={doc_json} onChange={onChange} diagsSource={diagsSource}/>, container);
    }

    static serializeDoc(doc) {
        var acc = [];
        doc.descendants(CoqProseMirror.process_node(acc));
        let res = CoqProseMirror.flatten_chunks(acc);
        return res;
    }

    getValue() {
        return "";
        // return CoqProseMirror.serializeDoc(this.view.state.doc);
    }

    clearMarks() {
        return ;
   /*      var tr = this.view.state.tr;
        tr.setMeta(coqDiags, "clear");
        this.view.dispatch(tr); */
    }

    getCursorOffset() {
        return 0;
/*         return this.view.state.selection.head; */
    }

    markDiagnostic(d, version) {
        return ;

        // This is racy w.r.t. user edits if we don't check the
/*         // document version; async stuff, always fun :)
        if (version === this.version) {
            var tr = this.view.state.tr;
            tr.setMeta(coqDiags, diagNew(d));
            this.view.dispatch(tr);
        } */
    }

    static process_node(acc) {
        return (node, pos, parent, index) => {
            if (node.type.name === schema.nodes.code_block.name) {
                let text = node.textContent;
                acc.push( { pos, text } );
                return true;
            }
        }
    }

    static flatten_chunks(acc) {
        var res = "";
        for (let c of acc) {
            let offset = c.pos - res.length;
            res += ' '.repeat(offset) + c.text;
        }
        return res;
    }
}

// Local Variables:
// js-indent-level: 4
// End:
