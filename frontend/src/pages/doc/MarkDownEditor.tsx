import React from "react";
import {
  MDXEditor,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  headingsPlugin,
  linkPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  CodeMirrorEditor,
  diffSourcePlugin,
  tablePlugin,
  thematicBreakPlugin,
  frontmatterPlugin,
  imagePlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import "@styles/md.css";

interface MarkDownEditorProps {
  content: string;
}

export class MarkDownEditor extends React.Component<MarkDownEditorProps> {
  constructor(props: MarkDownEditorProps) {
    super(props);
  }

  render() {
    return (
      <MDXEditor
        key={this.props.content}
        markdown={this.props.content}
        contentEditableClassName="markdown-body"
        readOnly={true}
        plugins={[
          // Core formatting plugins
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(), // Adds support for horizontal rules (---)

          // Link and image support
          linkPlugin(),
          linkDialogPlugin(),
          imagePlugin(), // Adds support for images

          // Table support
          tablePlugin(),

          // Code block support
          codeBlockPlugin({
            defaultCodeBlockLanguage: "txt",
            codeBlockEditorDescriptors: [
              {
                priority: 100,
                match: (_) => true,
                Editor: CodeMirrorEditor,
              },
            ],
          }),
          codeMirrorPlugin({
            codeBlockLanguages: {
              bash: "Bash",
              shell: "Shell",
              python: "Python",
              cpp: "C++",
              c: "C",
              javascript: "JavaScript",
              typescript: "TypeScript",
              jsx: "JSX",
              tsx: "TSX",
              json: "JSON",
              html: "HTML",
              css: "CSS",
              markdown: "Markdown",
              yaml: "YAML",
              sql: "SQL",
              verilog: "Verilog",
              vhdl: "VHDL",
              systemverilog: "SystemVerilog",
            },
          }),

          // Metadata support
          frontmatterPlugin(), // Adds support for YAML frontmatter

          // Diff support
          diffSourcePlugin(),

          // Shortcuts (still useful for navigation even in read-only)
          markdownShortcutPlugin(),
        ]}
      />
    );
  }
}
