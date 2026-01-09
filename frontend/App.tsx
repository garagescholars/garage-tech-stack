import React, { useState } from 'react';
import { ListingForm } from './components/ListingForm';
import { Sidebar } from './components/Sidebar';
import { StatusLog } from './components/StatusLog';
import { InventoryView } from './components/InventoryView';
import { ListingData, SubmissionStatus, InventoryItem } from './types';
import { publishListing } from './services/api';

// Mock Data for Inventory Demo
const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: '1',
    title: 'Vintage Leather Jacket - Size M',
    price: 120,
    imageUrl: 'https://images.unsplash.com/photo-1551028919-ac6635f0e5c9?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    status: 'Active',
    dateAdded: 'Oct 24',
  },
  {
    id: '2',
    title: 'Sony WH-1000XM4 Noise Canceling Headphones',
    price: 200,
    imageUrl: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    status: 'Sold',
    dateAdded: 'Oct 22',
  },
  {
    id: '3',
    title: 'Wooden Coffee Table (Mid-Century Modern)',
    price: 85,
    imageUrl: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    status: 'Draft',
    dateAdded: 'Oct 20',
  },
  {
    id: '4',
    title: 'Canon EOS Rebel T7 DSLR Camera',
    price: 350,
    imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    status: 'Active',
    dateAdded: 'Oct 18',
  }
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'new' | 'inventory'>('new');
  const [status, setStatus] = useState<SubmissionStatus>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  // In a real app, this would be fetched from the backend
  const [inventory] = useState<InventoryItem[]>(MOCK_INVENTORY); 

  const handleLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const handleSubmit = async (data: ListingData, imageFile: File | null) => {
    if (!imageFile) {
      handleLog('Error: No image selected.');
      return;
    }

    setStatus('submitting');
    handleLog('Starting publication process...');
    handleLog(`Preparing to list: ${data.title} for $${data.price}`);

    try {
      const result = await publishListing(data, imageFile);
      
      if (result.success) {
        setStatus('success');
        handleLog('Successfully published to configured marketplaces!');
        handleLog(`Backend response: ${result.message}`);
      } else {
        setStatus('error');
        handleLog(`Failed to publish: ${result.message}`);
      }
    } catch (error) {
      setStatus('error');
      handleLog(`Network or Server Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Fixed Sidebar */}
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      
      {/* Main Content Area - Shifted right by w-64 (256px) */}
      <div className="flex-grow ml-64 min-h-screen flex flex-col">
        {/* Simple Header for right side */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
          <div className="flex justify-between items-center">
             <h1 className="text-xl font-bold text-gray-800">
               {currentView === 'new' ? 'New Listing' : 'Inventory Management'}
             </h1>
             <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-sm text-gray-500 font-medium">System Online</span>
             </div>
          </div>
        </header>

        <main className="flex-grow container mx-auto px-8 py-8 max-w-7xl">
          {currentView === 'new' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Form */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </span>
                  New Item Details
                </h2>
                <ListingForm onSubmit={handleSubmit} isSubmitting={status === 'submitting'} />
              </div>

              {/* Right Column: Status & Instructions */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 h-96 flex flex-col">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="bg-purple-100 text-purple-600 p-2 rounded-lg mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                      </svg>
                    </span>
                    Live Automation Logs
                  </h2>
                  <StatusLog logs={logs} status={status} />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
                  <h3 className="font-bold text-blue-900 mb-2">Backend Required</h3>
                  <p>
                    This frontend connects to a local Python FastAPI backend. Ensure <code>main.py</code> is running on <code>localhost:8000</code> to enable automation features.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <InventoryView items={inventory} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;