import React from "react";
import {
  MDXEditor,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  headingsPlugin,
  linkPlugin,
  codeBlockPlugin,
  sandpackPlugin,
  codeMirrorPlugin,
  CodeMirrorEditor,
  diffSourcePlugin,
} from "@mdxeditor/editor";
import "@styles/md.css";

interface MarkDownEditorProps {}

export class MarkDownEditor extends React.Component<MarkDownEditorProps> {
  constructor(props: MarkDownEditorProps) {
    super(props);
  }

  render() {
    return (
      <MDXEditor
        markdown="# A Simple Markdown Example 

        ```cpp
        int main() {

          return 0;
        }
        ```
        "
        contentEditableClassName="markdown-body"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          markdownShortcutPlugin(),
          linkPlugin(),
          codeBlockPlugin({
            codeBlockEditorDescriptors: [
              { priority: -10, match: (_) => true, Editor: CodeMirrorEditor },
            ],
          }),
          sandpackPlugin(),
          codeMirrorPlugin({
            codeBlockLanguages: {
              bash: "shell",
              python: "python",
              cpp: "cpp",
              javascript: "javascript",
            },
          }),
          diffSourcePlugin(),
        ]}
      />
    );
  }
}
