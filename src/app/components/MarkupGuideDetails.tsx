export default function MarkupGuideDetails() {
  return (
    <div className="helper-expanded-detail">
      <p className="helper-philosophy-compact">
        Connect cases, statutes, doctrines, authorities, and source links as you write.
      </p>
      <div className="helper-detail-cols">
        <div className="helper-detail-col">
          <span className="helper-detail-title">Structure</span>
          <code># Heading</code>
          <code>## Sub-heading</code>
          <code>- Bullet point</code>
          <code>1. Numbered point</code>
          <code>&gt; Quoted text</code>
          <code>:::legal ... :::</code>
        </div>
        <div className="helper-detail-col">
          <span className="helper-detail-title">Link Knowledge</span>
          <code>[[topic-slug]]</code>
          <code>[[slug|Display Text]]</code>
          <code>[Label](https://source...)</code>
          <code>[web_1](https://source...)</code>
        </div>
        <div className="helper-detail-col">
          <span className="helper-detail-title">Authority Anchors</span>
          <code>Select claim text</code>
          <code>Attach Authority</code>
          <code>Case / Statute / Doctrine</code>
          <code>External Source</code>
        </div>
        <div className="helper-detail-col">
          <span className="helper-detail-title">Emphasis</span>
          <code>**Bold**</code>
          <code>*Italic*</code>
          <code>`Key term`</code>
          <code>---</code>
        </div>
      </div>
    </div>
  );
}
