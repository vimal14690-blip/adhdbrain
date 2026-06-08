import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export interface LocalNote {
  id: string;
  title: string;
  content: string;
}

interface BrainPopupProps {
  notes: LocalNote[];
  onClose: () => void;
}

export default function BrainPopup({ notes, onClose }: BrainPopupProps) {
  const [selectedNote, setSelectedNote] = useState<LocalNote | null>(notes.length > 0 ? notes[0] : null);

  const graphNodes = new Map();
  const graphLinks: any[] = [];

  notes.forEach(note => {
    if (!graphNodes.has(note.id)) {
      graphNodes.set(note.id, { id: note.id, name: note.title, group: 1 });
    }
    
    const regex = /\[\[(.*?)\]\]/g;
    let match;
    while ((match = regex.exec(note.content)) !== null) {
      const targetName = match[1];
      if (!graphNodes.has(targetName)) {
        graphNodes.set(targetName, { id: targetName, name: targetName, group: 2 });
      }
      graphLinks.push({ source: note.id, target: targetName });
    }
  });

  const graphData = {
    nodes: Array.from(graphNodes.values()),
    links: graphLinks
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '90vw', height: '85vh',
        backgroundColor: '#0f172a',
        borderRadius: '12px',
        border: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', backgroundColor: '#020617', borderBottom: '1px solid #334155' }}>
          <h2 style={{ color: '#38bdf8', fontSize: '1.2rem', margin: 0 }}>NeuroBrain Clinical Vault (Local Memory)</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left Pane: File Tree */}
          <div style={{ width: '250px', borderRight: '1px solid #334155', padding: '20px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '15px' }}>Session Notes</h3>
            {notes.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>No notes generated yet.</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {notes.map(note => (
                  <li 
                    key={note.id} 
                    onClick={() => setSelectedNote(note)}
                    style={{ 
                      padding: '8px', 
                      cursor: 'pointer', 
                      borderRadius: '4px',
                      backgroundColor: selectedNote?.id === note.id ? '#1e293b' : 'transparent',
                      marginBottom: '2px',
                      fontSize: '0.85rem',
                      color: 'white'
                    }}
                  >
                    📄 {note.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Center Pane: Editor/Viewer */}
          <div style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {selectedNote ? (
              <>
                <h1 style={{ fontSize: '1.8rem', marginBottom: '20px', color: 'white' }}>{selectedNote.title}</h1>
                <div 
                  style={{
                    flex: 1, width: '100%', color: '#e2e8f0',
                    fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.6',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {selectedNote.content}
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', opacity: 0.5, color: 'white' }}>Generate and save a note to view</div>
            )}
          </div>

          {/* Right Pane: Graph View */}
          <div style={{ width: '400px', borderLeft: '1px solid #334155', backgroundColor: '#020617' }}>
            <h2 style={{ fontSize: '0.9rem', padding: '15px', borderBottom: '1px solid #334155', margin: 0, color: '#94a3b8' }}>
              Neural Network Graph
            </h2>
            <div style={{ height: 'calc(100% - 47px)' }}>
              {graphData.nodes.length > 0 ? (
                <ForceGraph2D
                  graphData={graphData}
                  width={400}
                  backgroundColor="#020617"
                  nodeAutoColorBy="group"
                  nodeLabel="name"
                  linkDirectionalArrowLength={3.5}
                  linkDirectionalArrowRelPos={1}
                />
              ) : (
                <div style={{ padding: '20px', opacity: 0.5, fontSize: '0.8rem', color: 'white' }}>Graph will appear when notes contain [[links]]</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
