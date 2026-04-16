import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { prompts } from '../lib/prompts';

type ConfigType = 'text' | 'number' | 'boolean';

interface ConfigDefinition {
  type: ConfigType;
  default: string;
  label: string;
}

const configSchema: Record<string, ConfigDefinition> = {
  PINECONE_INDEX: { type: 'text', default: 'your-target-index', label: 'Pinecone Index' },
  MONGO_DB: { type: 'text', default: 'my_db', label: 'Mongo DB' },
  NAMESPACE: { type: 'text', default: 'your-namespace', label: 'Namespace' },
  MONGO_COLLECTION: { type: 'text', default: 'my_collection_prefix', label: 'Mongo Collection' },
  CONTEXT: { type: 'text', default: 'General overarching context for the clustering task.', label: 'Context' },
  MODEL: { type: 'text', default: 'multilingual-e5-large', label: 'Model' },
  NUM_CLUSTERS: { type: 'number', default: '2', label: 'Num Clusters' },
  BATCH_SIZE: { type: 'number', default: '50', label: 'Batch Size' },
  PCA_DIMENSIONS: { type: 'number', default: '20', label: 'PCA Dimensions' },
  SKIP_EMBED: { type: 'boolean', default: 'false', label: 'Skip Embed' },
  CUMULATIVE: { type: 'boolean', default: 'false', label: 'Cumulative' },
  STORE_REDUCED_DIMENSIONS: { type: 'boolean', default: 'true', label: 'Store Reduced Dimensions' },
  REDUCE_DIMENSIONS: { type: 'boolean', default: 'true', label: 'Reduce Dimensions' },
};

const App = () => {
  const [docsData, setDocsData] = useState<Record<string, string>>({});
  const [rawDocsData, setRawDocsData] = useState<Record<string, string>>({});
  const [activeDoc, setActiveDoc] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'docs' | 'playground' | 'prompts'>('docs');
  const [configValues, setConfigValues] = useState<Record<string, string>>(() => {
    const initialValues: Record<string, string> = {};
    Object.keys(configSchema).forEach(key => {
      initialValues[key] = localStorage.getItem(key) || configSchema[key].default;
    });
    return initialValues;
  });

  useEffect(() => {
    Object.keys(configValues).forEach(key => {
      localStorage.setItem(key, configValues[key]);
    });
  }, [configValues]);

  useEffect(() => {
    fetch('/build/docs.json')
      .then(res => res.json())
      .then(data => {
        setRawDocsData(data);
        if (Object.keys(data).length > 0) {
          setActiveDoc(Object.keys(data)[0]);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const processedData: Record<string, string> = {};
    Object.keys(rawDocsData).forEach(key => {
      let content = rawDocsData[key].replace(/\{\{DOMAIN\}\}/g, window.location.origin);
      Object.keys(configSchema).forEach(configKey => {
        const regex = new RegExp(`\\{\\{${configKey}\\}\\}`, 'g');
        content = content.replace(regex, configValues[configKey]);
      });
      processedData[key] = content;
    });
    setDocsData(processedData);
  }, [rawDocsData, configValues]);

  const activeDocRawContent = rawDocsData[activeDoc] || '';
  const usedConfigKeys = Object.keys(configSchema).filter(key =>
    activeDocRawContent.includes(`{{${key}}}`)
  );

  useEffect(() => {
    const btns = document.querySelectorAll('[id^=copy-agent-btn]');
    const handlers: { btn: Element, handler: EventListener }[] = [];

    btns.forEach(btn => {
      const handleCopy = () => {
        const parent = btn.parentElement;
        const pre = parent ? parent.previousElementSibling : null;
        if (pre && pre.tagName === 'PRE') {
          navigator.clipboard.writeText(pre.textContent || '').then(() => {
            const originalText = (btn as HTMLElement).innerText;
            (btn as HTMLElement).innerText = 'Copied!';
            setTimeout(() => { (btn as HTMLElement).innerText = originalText; }, 2000);
          });
        }
      };
      btn.addEventListener('click', handleCopy);
      handlers.push({ btn, handler: handleCopy });
    });

    return () => {
      handlers.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
    };
  }, [activeDoc, docsData]);

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
          <li className={activeTab === 'prompts' ? 'is-active' : ''}>
            <a onClick={() => setActiveTab('prompts')}>Prompts</a>
          </li>
        </ul>
      </div>

      {activeTab === 'docs' && (
        <div className="columns">
          <div className="column is-one-quarter">
            <aside className="menu">
              <p className="menu-label">API Endpoints</p>
              <ul className="menu-list">
                {Object.keys(docsData).filter(key => key !== 'development.md').map(docKey => (
                  <li key={docKey}>
                    <a
                      className={activeDoc === docKey ? 'is-active' : ''}
                      onClick={() => setActiveDoc(docKey)}
                    >
                      {docKey.replace('.md', '')}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="menu-label">Development Setup</p>
              <ul className="menu-list">
                {Object.keys(docsData).filter(key => key === 'development.md').map(docKey => (
                  <li key={docKey}>
                    <a
                      className={activeDoc === docKey ? 'is-active' : ''}
                      onClick={() => setActiveDoc(docKey)}
                    >
                      {docKey.replace('.md', '')}
                    </a>
                  </li>
                ))}
              </ul>

              {usedConfigKeys.length > 0 && (
                <>
                  <p className="menu-label mt-5">Configuration</p>
                  {usedConfigKeys.map(key => {
                    const schema = configSchema[key];
                    return (
                      <div className="field" key={key}>
                        <label className="label is-small">{schema.label}</label>
                        <div className="control">
                          {schema.type === 'boolean' ? (
                            <div className="select is-small is-fullwidth">
                              <select
                                value={configValues[key]}
                                onChange={(e) => setConfigValues({ ...configValues, [key]: e.target.value })}
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            </div>
                          ) : (
                            <input
                              className="input is-small"
                              type={schema.type === 'number' ? 'number' : 'text'}
                              value={configValues[key]}
                              onChange={(e) => setConfigValues({ ...configValues, [key]: e.target.value })}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </aside>
          </div>
          <div className="column">
            <div className="content" dangerouslySetInnerHTML={{ __html: docsData[activeDoc] || 'Loading docs...' }} />
          </div>
        </div>
      )}

      {activeTab === 'playground' && <Playground />}

      {activeTab === 'prompts' && <PromptsView />}
    </div>
  );
};

const PromptsView = () => {
  return (
    <div className="box">
      <h2 className="subtitle">System Prompts</h2>
      {prompts.map((prompt) => (
        <div key={prompt.name} className="content mb-5">
          <h3 className="is-size-5">{prompt.name}</h3>
          <p><em>{prompt.description}</em></p>
          <pre><code>{prompt.template}</code></pre>
        </div>
      ))}
    </div>
  );
};

const Playground = () => {
  const [inputText, setInputText] = useState('{"id":"1", "text":"Hello cloud!"}');
  const [numClusters, setNumClusters] = useState('2');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState<'embed' | 'cluster-background' | 'refine-clusters'>('embed');

  const handleTest = async () => {
    setLoading(true);
    setResult('');
    try {
      const parsedInput = JSON.parse(inputText);
      const body: any = endpoint === 'refine-clusters' ? parsedInput : { texts: [parsedInput] };

      if (endpoint === 'cluster-background') {
        body.numClusters = parseInt(numClusters, 10);
      }

      const response = await fetch(`/.netlify/functions/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if ((endpoint === 'cluster-background' || endpoint === 'refine-clusters') && response.status === 202) {
        setResult('Accepted for background processing. Check Netlify logs.');
      } else {
        const data = await response.json();
        setResult(JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      setResult(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="box">
      <h2 className="subtitle">Playground API Endpoints</h2>
      <div className="field">
        <label className="label">Select Endpoint</label>
        <div className="control">
          <div className="select">
            <select value={endpoint} onChange={e => setEndpoint(e.target.value as any)}>
              <option value="embed">Embed (POST /.netlify/functions/embed)</option>
              <option value="cluster-background">Cluster Background (POST /.netlify/functions/cluster-background)</option>
              <option value="refine-clusters">Refine Clusters (POST /.netlify/functions/refine-clusters)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="field">
        <label className="label">JSON Record (Single Text)</label>
        <div className="control">
          <textarea
            className="textarea"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
        </div>
      </div>

      {endpoint === 'cluster-background' && (
        <div className="field">
          <label className="label">Number of Clusters</label>
          <div className="control">
            <input
              className="input"
              type="number"
              value={numClusters}
              onChange={e => setNumClusters(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="field">
        <div className="control">
          <button className={`button is-primary ${loading ? 'is-loading' : ''}`} onClick={handleTest}>
            Test {endpoint}
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

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}
