'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Import ForceGraph dynamically to prevent SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function Brain2Page() {
  const [session, setSession] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/auth');
      } else {
        setSession(session);
        fetchData();
      }
    });
  }, [router]);

  const fetchData = async () => {
    const { data: pts } = await supabase.from('patients').select('*');
    if (pts) setPatients(pts);

    const { data: nts } = await supabase.from('notes').select('*');
    if (nts) setNotes(nts);
    
    setLoading(false);
  };

  if (loading) return <div style={{ color: 'white', padding: '20px' }}>Loading Knowledge Base...</div>;

  // Generate graph data from bi-directional links (e.g. [[Tag]])
  const graphNodes = new Map();
  const graphLinks: any[] = [];

  notes.forEach(note => {
    if (!graphNodes.has(note.id)) {
      graphNodes.set(note.id, { id: note.id, name: note.title, group: 1 });
    }
    
    // Simple regex to find [[links]]
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
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0f172a', color: 'white' }}>
      
      {/* Left Pane: File Tree */}
      <div style={{ width: '250px', borderRight: '1px solid #334155', padding: '20px', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#38bdf8' }}>NeuroBrain Vault</h2>
        
        {patients.length === 0 && <p style={{ opacity: 0.5 }}>No patients assigned.</p>}
        
        {patients.map(patient => (
          <div key={patient.id} style={{ marginBottom: '15px' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>{patient.name}</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0' }}>
              {notes.filter(n => n.patient_id === patient.id).map(note => (
                <li 
                  key={note.id} 
                  onClick={() => setSelectedNote(note)}
                  style={{ 
                    padding: '8px', 
                    cursor: 'pointer', 
                    borderRadius: '4px',
                    backgroundColor: selectedNote?.id === note.id ? '#1e293b' : 'transparent',
                    marginBottom: '2px',
                    fontSize: '0.85rem'
                  }}
                >
                  📄 {note.title}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Center Pane: Editor/Viewer */}
      <div style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {selectedNote ? (
          <>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>{selectedNote.title}</h1>
            <textarea 
              value={selectedNote.content}
              onChange={async (e) => {
                const newContent = e.target.value;
                setSelectedNote({ ...selectedNote, content: newContent });
                
                // Update local state
                setNotes(notes.map(n => n.id === selectedNote.id ? { ...n, content: newContent } : n));
                
                // Debounced save to DB could go here, for now just fire it
                await supabase.from('notes').update({ content: newContent }).eq('id', selectedNote.id);
              }}
              style={{
                flex: 1,
                width: '100%',
                backgroundColor: 'transparent',
                color: '#e2e8f0',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                lineHeight: '1.6'
              }}
            />
          </>
        ) : (
          <div style={{ margin: 'auto', opacity: 0.5 }}>Select a note to view</div>
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
            <div style={{ padding: '20px', opacity: 0.5, fontSize: '0.8rem' }}>Graph will appear when notes contain [[links]]</div>
          )}
        </div>
      </div>

    </div>
  );
}
