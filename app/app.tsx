import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
  const [docsHtml, setDocsHtml] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'docs' | 'playground' | 'subscriptions'>('docs');

  useEffect(() => {
    fetch('/build/docs.json')
      .then(res => res.json())
      .then(data => {
        let content = data['library-usage.md'] || 'Failed to load docs';
        content = content.replace(/\{\{DOMAIN\}\}/g, window.location.origin);
        setDocsHtml(content);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="container mt-5">
      <h1 className="title">Data Platform</h1>

      <div className="tabs is-boxed">
        <ul>
          <li className={activeTab === 'docs' ? 'is-active' : ''}>
            <a onClick={() => setActiveTab('docs')}>Documentation</a>
          </li>
          <li className={activeTab === 'playground' ? 'is-active' : ''}>
            <a onClick={() => setActiveTab('playground')}>Playground</a>
          </li>
          <li className={activeTab === 'subscriptions' ? 'is-active' : ''}>
            <a onClick={() => setActiveTab('subscriptions')}>Subscriptions</a>
          </li>
        </ul>
      </div>

      {activeTab === 'docs' && (
        <div className="content" dangerouslySetInnerHTML={{ __html: docsHtml }} />
      )}

      {activeTab === 'playground' && <Playground />}

      {activeTab === 'subscriptions' && <Subscriptions />}
    </div>
  );
};

const Playground = () => {
  const [inputText, setInputText] = useState('{"id":"1", "text":"Hello cloud!"}');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setResult('');
    try {
      const texts = [JSON.parse(inputText)];

      const response = await fetch('/.netlify/functions/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts })
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResult(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="box">
      <h2 className="subtitle">Playground API Endpoints</h2>
      <p>This playground tests the cloud version calling the <code>POST /.netlify/functions/embed</code> endpoint.</p>
      <br/>
      <div className="field">
        <label className="label">JSON Record</label>
        <div className="control">
          <textarea
            className="textarea"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <div className="control">
          <button className={`button is-primary ${loading ? 'is-loading' : ''}`} onClick={handleTest}>
            Test Embed
          </button>
        </div>
      </div>
      {result && (
        <div className="field">
          <label className="label">Result</label>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
};

const Subscriptions = () => {
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleEmbedChannels = async () => {
    setLoading(true);
    setToastMessage(null);
    try {
      const texts = Array.from({ length: 1000 }, (_, i) => ({
        id: `channel-${i + 1}`,
        text: `Channel description ${i + 1}`
      }));

      const response = await fetch('https://mm-dp.netlify.app/.netlify/functions/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts,
          batchSize: 50,
          indexName: 'Finder',
          namespace: 'ChannelDescriptions'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error occurred');
      }

      setToastMessage(`Success: Embedded ${data.writes} records in ${data.elapsedMs}ms`);
    } catch (e: any) {
      setToastMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="box">
      <h2 className="subtitle">Embed Channel Descriptions</h2>
      <p>This will embed the top 1,000 channel descriptions into the <code>Finder</code> index and <code>ChannelDescriptions</code> namespace.</p>
      <br/>
      <div className="field">
        <div className="control">
          <button className={`button is-primary ${loading ? 'is-loading' : ''}`} onClick={handleEmbedChannels}>
            Embed Channels
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          className="notification is-info"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            minWidth: '300px'
          }}
        >
          <button className="delete" onClick={() => setToastMessage(null)}></button>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}
