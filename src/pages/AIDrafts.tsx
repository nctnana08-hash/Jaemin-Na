import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { BrainCircuit, Loader2, Save, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

export default function AIDrafts() {
  const { user } = useAuth();
  const [topicPrompt, setTopicPrompt] = useState('');
  const [difficulty, setDifficulty] = useState('Average');
  const [isGenerating, setIsGenerating] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);

  // Pre-generation selections
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');

  // Helper to filter categories based on selectedTrack
  const filteredCategories = categories.filter(cat => {
    if (!selectedTrack) return false;
    if (selectedTrack === 'all') return true;
    const tracks = cat.reviewTracks || (cat.id === 'major' ? ['secondary', 'specialization'] : ['elementary', 'secondary']);
    return tracks.includes(selectedTrack) || tracks.includes('all');
  });

  // Post-generation mapping override
  const [selectedMapping, setSelectedMapping] = useState<Record<string, { categoryId: string, topicId: string }>>({});

  useEffect(() => {
    const q = query(collection(db, 'aiDrafts'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const ms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDrafts(ms);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, 'categories'), s => {
      setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTop = onSnapshot(collection(db, 'topics'), s => {
      setTopics(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubCat(); unsubTop(); };
  }, []);

  const handleGenerate = async () => {
    if (!selectedTrack || !selectedCategoryId || !selectedTopicId || !topicPrompt) {
       setToastMsg('Please select a Track, Curriculum Subject, Topic, and enter a Subtopic prompt.');
       setShowToast(true);
       return;
    }

    const catName = categories.find(c => c.id === selectedCategoryId)?.title || categories.find(c => c.id === selectedCategoryId)?.name || '';
    const topName = topics.find(t => t.id === selectedTopicId)?.title || '';

    setIsGenerating(true);
    try {
      const res = await fetch('/api/draft-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           topic: `${catName} - ${topName}: ${topicPrompt}`, 
           difficulty, 
           count: 5 
        })
      });
      const data = await res.json();
      if (data.success) {
        const { serverTimestamp } = await import('firebase/firestore');
        for (const q of data.questions) {
          // Add directly to main questions collection with approved = true and isPublished = true
          await addDoc(collection(db, 'questions'), {
            stem: q.stem,
            options: q.options,
            correctOptionId: q.correctOptionId,
            explanation: q.explanation || '',
            categoryId: selectedCategoryId,
            topicId: selectedTopicId,
            difficulty: difficulty,
            approved: true, // auto-approve
            isPublished: true, // published to go directly inside question bank
            aiGenerated: true,
            createdBy: user?.uid,
            version: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Log in aiDrafts with 'approved' status
          await addDoc(collection(db, 'aiDrafts'), {
            ...q,
            draftTopic: topicPrompt,
            difficulty,
            status: 'approved',
            instructorId: user?.uid,
            preAssignedCategoryId: selectedCategoryId,
            preAssignedTopicId: selectedTopicId,
            createdAt: serverTimestamp()
          });
        }
        setToastMsg('Successfully generated and auto-approved 5 questions into the Question Bank!');
        setShowToast(true);
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      setToastMsg('Failed to generate drafts: ' + e.message);
      setShowToast(true);
    } finally {
      setIsGenerating(false);
      setTopicPrompt('');
    }
  };

  const approveDraft = async (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;

    const catId = selectedMapping[draftId]?.categoryId || draft.preAssignedCategoryId;
    const topId = selectedMapping[draftId]?.topicId || draft.preAssignedTopicId;

    if (!catId || !topId) {
      setToastMsg('Please select a category and topic for this draft first.');
      setShowToast(true);
      return;
    }

    try {
       const { updateDoc, serverTimestamp } = await import('firebase/firestore');
       await addDoc(collection(db, 'questions'), {
          stem: draft.stem,
          options: draft.options,
          correctOptionId: draft.correctOptionId,
          explanation: draft.explanation,
          categoryId: catId,
          topicId: topId,
          difficulty: draft.difficulty,
          approved: true,
          isPublished: true,
          aiGenerated: true,
          createdBy: user?.uid,
          version: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
       });

       await updateDoc(doc(db, 'aiDrafts', draftId), {
         status: 'approved',
         reviewedAt: serverTimestamp(),
         reviewedBy: user?.uid,
         assignedCategoryId: catId,
         assignedTopicId: topId
       });

       setToastMsg('Question approved and saved to bank!');
       setShowToast(true);
    } catch (e: any) {
       setToastMsg('Failed to approve: ' + e.message);
       setShowToast(true);
    }
  };

  const rejectDraft = async (id: string) => {
    try {
      const { updateDoc, serverTimestamp } = await import('firebase/firestore');
      await updateDoc(doc(db, 'aiDrafts', id), {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.uid
      });
      setToastMsg('Draft discarded');
      setShowToast(true);
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <DashboardLayout title="AI Question Drafter">
      <div className="p-8 max-w-6xl mx-auto w-full">
        <div className="mb-10">
           <h2 className="text-3xl font-extrabold font-headline text-primary flex items-center gap-3">
             <BrainCircuit /> AI Question Drafter
           </h2>
           <p className="text-on-surface-variant/60 mt-2">Generate high-quality board exam questions instantly using AI, referenced against your exact curriculum.</p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant p-8 mb-8">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pb-6 border-b border-outline-variant/20">
              <div>
                 <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">1. Select LET Track</label>
                 <select 
                   value={selectedTrack}
                   onChange={e => { setSelectedTrack(e.target.value); setSelectedCategoryId(''); setSelectedTopicId(''); }}
                   className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary/50 transition-all font-medium"
                 >
                   <option value="">-- Choose Track --</option>
                   <option value="elementary">Elementary Education</option>
                   <option value="secondary">Secondary Education</option>
                   <option value="all">General / Common (All)</option>
                 </select>
              </div>
              <div className={`${!selectedTrack ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">2. Select Curriculum Subject</label>
                 <select 
                   value={selectedCategoryId}
                   disabled={!selectedTrack}
                   onChange={e => { setSelectedCategoryId(e.target.value); setSelectedTopicId(''); }}
                   className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary/50 transition-all font-medium"
                 >
                   <option value="">-- Choose Subject --</option>
                   {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.title || c.name}</option>)}
                 </select>
              </div>
              <div className={`${!selectedCategoryId ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">3. Select Topic Area</label>
                 <select 
                   value={selectedTopicId}
                   disabled={!selectedCategoryId}
                   onChange={e => setSelectedTopicId(e.target.value)}
                   className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary/50 transition-all font-medium"
                 >
                   <option value="">-- Choose Topic --</option>
                   {topics.filter(t => t.categoryId === selectedCategoryId).map(t => (
                     <option key={t.id} value={t.id}>{t.title}</option>
                   ))}
                 </select>
              </div>
           </div>

           <div className={`transition-opacity duration-300 ${!selectedTopicId ? 'opacity-50 pointer-events-none' : ''}`}>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">4. Subtopic or Specific Standard</label>
                   <input 
                     type="text" 
                     value={topicPrompt}
                     onChange={r => setTopicPrompt(r.target.value)}
                     placeholder="e.g. Cognitive Development stages, K-12 Act..."
                     className="w-full bg-surface-container border border-outline-variant/50 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/40 font-medium"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">5. Difficulty Level</label>
                   <select 
                     value={difficulty}
                     onChange={e => setDifficulty(e.target.value)}
                     className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary/50 transition-all font-medium"
                   >
                     <option>Easy</option>
                     <option>Average</option>
                     <option>Difficult</option>
                     <option>Bloom's Taxonomy: Analysis/Evaluation</option>
                   </select>
                </div>
             </div>
             <div className="mt-6 flex justify-end">
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !selectedTrack || !selectedCategoryId || !selectedTopicId || !topicPrompt.trim()}
                  className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2 transition-all hover:opacity-90 active:scale-95"
                >
                   {isGenerating ? <><Loader2 className="animate-spin" /> Gathering Intel...</> : 'Generate 5 Questions'}
                </button>
             </div>
           </div>
        </div>

        {drafts.length > 0 && (
          <div className="space-y-6">
             <h3 className="text-xl font-bold text-on-surface">Pending Review ({drafts.length})</h3>
             {drafts.map((draft, i) => {
                const currentCat = selectedMapping[draft.id]?.categoryId || draft.preAssignedCategoryId;
                const currentTop = selectedMapping[draft.id]?.topicId || draft.preAssignedTopicId;

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={draft.id} 
                    className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm p-6 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-100 flex gap-2">
                       <button onClick={() => rejectDraft(draft.id)} className="p-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors" title="Discard"><Trash2 size={18} /></button>
                       <button onClick={() => approveDraft(draft.id)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1 font-bold text-sm" title="Approve"><Save size={18}/> Approve</button>
                    </div>
                    
                    <div className="mb-4 flex gap-4 opacity-60 hover:opacity-100 transition-opacity">
                       <div className="flex-1">
                          <label className="block text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-1">Target Category</label>
                          <select 
                            value={currentCat || ''}
                            onChange={(e) => setSelectedMapping({
                              ...selectedMapping,
                              [draft.id]: { ...selectedMapping[draft.id], categoryId: e.target.value, topicId: '' }
                            })}
                            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 text-xs font-bold text-on-surface focus:outline-none"
                          >
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.title || c.name}</option>)}
                          </select>
                       </div>
                       <div className="flex-1">
                          <label className="block text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-1">Target Topic</label>
                          <select 
                            value={currentTop || ''}
                            disabled={!currentCat}
                            onChange={(e) => setSelectedMapping({
                              ...selectedMapping,
                              [draft.id]: { categoryId: currentCat, topicId: e.target.value }
                            })}
                            className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 text-xs font-bold text-on-surface focus:outline-none disabled:opacity-30"
                          >
                            <option value="">Select Topic</option>
                            {topics.filter(t => t.categoryId === currentCat).map(t => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                       </div>
                    </div>

                    <h4 className="font-bold text-lg text-on-surface mb-4 pr-32">{draft.stem}</h4>
                    <div className="space-y-2 mb-4">
                       {draft.options?.map((opt: any) => (
                         <div key={opt.id} className={`p-3 rounded-xl text-sm ${opt.id === draft.correctOptionId ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold' : 'bg-surface-container text-on-surface-variant border border-outline-variant/10'}`}>
                           <span className="inline-block w-6 font-bold">{opt.id}.</span> {opt.text}
                         </div>
                       ))}
                    </div>
                    <div className="text-sm bg-primary/5 border border-primary/10 text-on-surface-variant p-4 rounded-xl">
                      <strong>Explanation:</strong> {draft.explanation}
                    </div>
                  </motion.div>
                );
             })}
          </div>
        )}

        <Toast message={toastMsg} isVisible={showToast} onClose={() => setShowToast(false)} type={toastMsg.includes('Failed') ? 'error' : 'success'} />
      </div>
    </DashboardLayout>
  );
}
