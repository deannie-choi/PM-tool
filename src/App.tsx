import React, { useState, useEffect, useId, useRef, useCallback, useMemo } from 'react';
import { 
  Ship, Truck, Wrench, LayoutDashboard, FolderKanban, 
  Settings, Bell, Search, CheckCircle2, Circle, Clock,
  ChevronRight, Plus, MoreVertical, MapPin, Calendar,
  ArrowLeft, Edit3, Sparkles, FileText, Activity,
  Check, Factory, PlayCircle, Save, X, Trash2, Filter,
  LogOut, User, ChevronDown, CreditCard, Building2, DollarSign,
  Network, BookOpen, GitBranch, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SOPView } from './components/SOPView';
import { db, auth, googleProvider } from './firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type Stage = 'Manufacturing' | 'Ocean Freight' | 'Inland Transport' | 'Installation' | 'Commissioning';

export interface AppUser {
  id: string;
  username: string;
  email: string;
  password?: string;
  name: string;
  role: 'admin' | 'leader' | 'member';
}

export interface PaymentMilestone {
  id: string;
  name: string;
  isDone: boolean;
  customerAmount: number;
  customerStatus: 'Paid' | 'Invoiced' | 'Pending';
  hqAmount: number;
  hqStatus: 'Paid' | 'Pending' | 'Not Started';
  
  // Customer (AR) Details
  customerInvoiceDate?: string;
  customerInvoiceNumber?: string;
  customerNetTerms?: string;
  customerDueDate?: string;
  customerDateReceived?: string;
  customerRetainagePercent?: number;
  customerRetainageAmount?: number;
  customerSalesTaxPercent?: number;
  customerSalesTaxAmount?: number;
  customerPaymentAmount?: number;

  // HQ (AP) Details
  hqInvoiceDate?: string;
  hqInvoiceNumber?: string;
  hqNetTerms?: string;
  hqDueDate?: string;
  hqDatePaid?: string;
  hqRetainagePercent?: number;
  hqRetainageAmount?: number;
  hqSalesTaxPercent?: number;
  hqSalesTaxAmount?: number;
  hqPaymentAmount?: number;
}

export interface ProjectPaymentData {
  totalRevenue: number;
  totalCost: number;
  milestones: PaymentMilestone[];
}

interface Project {
  id: string;
  name: string;
  customer: string;
  serialNumber: string;
  drawingNumber: string;
  currentStage: Stage;
  origin: string;
  destination: string;
  startDate: string;
  estFinalDelivery: string;
  assignedTo: string | null;
  oceanFreight: {
    fobDate: string;
    cifDate: string;
    etd: string;
    eta: string;
    atd: string;
    ata: string;
    documents: { name: string; received: boolean; date?: string }[];
  };
  inlandTransport: {
    ddpDate: string;
    carrier: string;
    dischargingMethod: string;
    etd: string;
    eta: string;
    atd: string;
    ata: string;
    siteVisit: string;
    railClearance: boolean | string;
    roadPermit: boolean;
    podReceived: boolean;
    inventory?: string;
    transitTime?: string;
    port?: string;
    siteContact?: string;
    railcarNumber?: string;
    siteVisitReport?: boolean;
    loadingDrawing?: boolean;
    transportationPlan?: boolean;
    hhVendor?: string;
    riggingVendor?: string;
    workflow?: Record<string, boolean>;
  };
  installation: {
    startDate: string;
    endDate: string;
    contractor: string;
    supervisor: string;
    oilTotalReq: string;
    oilDeliveries: { name: string; date: string; time: string }[];
    completionReport: boolean;
  };
  logs: { id: string; date: string; message: string; type: 'info' | 'warning' | 'error' | 'success' }[];
  paymentMilestones?: ProjectPaymentData;
  unitType?: 'HDE' | 'HPT' | '';
  kv?: string;
  mva?: string;
  sopTracker?: Record<string, { completed: boolean; date?: string; note?: string }>;
}

function Login({ onLogin }: { onLogin: (u: AppUser) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'leader' | 'member'>('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // We use a fake domain so users can just type "admin" or "leader"
    const email = `${username.toLowerCase().trim()}@transfotrack.com`;
    
    try {
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (userDoc.exists()) {
          onLogin(userDoc.data() as AppUser);
        } else {
          onLogin({
            id: result.user.uid,
            username: email.split('@')[0],
            email: email,
            name: result.user.displayName || 'Unknown User',
            role: 'member'
          });
        }
      } else {
        if (!username || !password || !name) {
          setError('Please fill in all fields.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        const newUser: AppUser = {
          id: user.uid,
          username: username.toLowerCase().trim(),
          email: email,
          name,
          role
        };
        await setDoc(doc(db, 'users', user.uid), newUser);
        onLogin(newUser);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Username already exists.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        if (isLogin) {
          setError('Invalid username or password. If you haven\'t created an account yet, please Sign Up first.');
        } else {
          setError('Invalid username or password.');
        }
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Action required: Please enable "Email/Password" in your Firebase Console (Authentication > Sign-in method).');
      } else {
        setError(err.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      let appUser: AppUser;
      if (userDoc.exists()) {
        appUser = userDoc.data() as AppUser;
      } else {
        // Create new user
        const isDefaultAdmin = user.email === 'cdh0118@gmail.com' && user.emailVerified;
        appUser = {
          id: user.uid,
          username: user.email?.split('@')[0] || 'user',
          email: user.email || '',
          name: user.displayName || 'Unknown User',
          role: isDefaultAdmin ? 'admin' : 'member'
        };
        await setDoc(userDocRef, appUser);
      }
      onLogin(appUser);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setError('Sign in was cancelled.');
      } else {
        setError(err.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light font-sans text-brand-dark p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl border border-brand-secondary/30 w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-xl bg-brand-dark text-brand-light flex items-center justify-center font-bold text-3xl shadow-sm">
            T
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-brand-dark mb-2">TransfoTrack</h2>
        <p className="text-center text-brand-dark/80 mb-8 text-sm">
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => { setName(e.target.value); setError(''); }} 
                  className="w-full px-4 py-2 border border-brand-secondary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50" 
                  placeholder="e.g. John Doe" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Role</label>
                <select 
                  value={role}
                  onChange={e => setRole(e.target.value as 'admin' | 'leader' | 'member')}
                  className="w-full px-4 py-2 border border-brand-secondary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50 bg-white"
                >
                  <option value="member">Team Member</option>
                  <option value="leader">Leader</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => { setUsername(e.target.value); setError(''); }} 
              className="w-full px-4 py-2 border border-brand-secondary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50" 
              placeholder="e.g. admin" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => { setPassword(e.target.value); setError(''); }} 
              className="w-full px-4 py-2 border border-brand-secondary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50" 
              placeholder="•••••••• (min 6 chars)" 
            />
          </div>
          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-brand-dark text-brand-light rounded-lg font-medium hover:bg-brand-dark/90 transition-colors shadow-sm disabled:opacity-50">
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); setUsername(''); setPassword(''); setName(''); setRole('member'); }}
            className="text-sm text-brand-dark/80 hover:text-brand-dark font-medium transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
        
        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="h-px bg-brand-dark/10 flex-1"></div>
          <span className="text-xs text-brand-secondary font-medium uppercase">Or continue with</span>
          <div className="h-px bg-brand-dark/10 flex-1"></div>
        </div>

        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-6 w-full py-2.5 bg-white border border-brand-secondary/50 text-brand-dark rounded-lg font-medium hover:bg-brand-muted/15 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          Google
        </button>

        {isLogin && (
          <div className="mt-8 p-4 bg-brand-muted/15 rounded-lg text-sm text-brand-dark/70 border border-brand-secondary/30">
            <p className="font-bold mb-2 text-brand-dark">Test Accounts (Please Sign Up first):</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2"><User size={14} className="text-brand-secondary" /> Create <strong>admin</strong> (Role: Admin)</li>
              <li className="flex items-center gap-2"><User size={14} className="text-brand-secondary" /> Create <strong>leader</strong> (Role: Leader)</li>
              <li className="flex items-center gap-2"><User size={14} className="text-brand-secondary" /> Create <strong>member1</strong> (Role: Team Member)</li>
            </ul>
            <p className="mt-3 text-xs text-brand-secondary italic">
              * Since we are using a real database now, you must create these accounts via "Sign Up" before logging in.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function AdminDashboard({ users, currentUser, onLogout }: { users: AppUser[], currentUser: AppUser, onLogout: () => void }) {
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleDeleteClick = (user: AppUser) => {
    if (user.id === currentUser.id) return alert("Cannot delete yourself");
    setUserToDelete(user);
    setDeleteConfirmText('');
  };

  const confirmDelete = async () => {
    if (userToDelete && deleteConfirmText === userToDelete.username) {
      try {
        await deleteDoc(doc(db, 'users', userToDelete.id));
        setUserToDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${userToDelete.id}`);
      }
    }
  };

  const handleRoleChange = async (id: string, newRole: 'admin' | 'leader' | 'member') => {
    if (id === currentUser.id) return alert("Cannot change your own role");
    try {
      await updateDoc(doc(db, 'users', id), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-brand-light text-brand-dark relative">
      <aside className="w-64 bg-white border-r border-brand-secondary/30 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-brand-secondary/30">
          <div className="w-10 h-10 rounded-xl bg-brand-dark text-brand-light flex items-center justify-center font-bold text-xl shadow-sm">T</div>
          <h1 className="font-bold text-xl tracking-tight text-brand-dark">Admin</h1>
        </div>
        <div className="flex-1 p-4">
          <div className="px-4 py-3 bg-brand-muted/15 rounded-xl font-medium flex items-center gap-3 text-brand-dark">
            <User size={20} /> User Management
          </div>
        </div>
        <div className="p-4 space-y-2">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-brand-secondary/30 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-xl font-bold">User Management</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{currentUser.name}</span>
            <div className="w-8 h-8 rounded-full bg-brand-dark text-brand-light flex items-center justify-center font-medium text-sm">
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <div className="bg-white rounded-xl shadow-sm border border-brand-secondary/30 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-muted/15 border-b border-brand-secondary/30">
                <tr>
                  <th className="px-6 py-4 font-medium text-brand-dark/80">Name</th>
                  <th className="px-6 py-4 font-medium text-brand-dark/80">Username</th>
                  <th className="px-6 py-4 font-medium text-brand-dark/80">Role</th>
                  <th className="px-6 py-4 font-medium text-brand-dark/80 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-dark/10">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-brand-muted/15 transition-colors">
                    <td className="px-6 py-4 font-medium">{user.name}</td>
                    <td className="px-6 py-4 text-brand-dark/80">{user.username}</td>
                    <td className="px-6 py-4">
                      <select 
                        value={user.role} 
                        onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                        disabled={user.id === currentUser.id}
                        className="bg-transparent border border-brand-secondary/50 rounded px-2 py-1 focus:outline-none focus:border-brand-dark"
                      >
                        <option value="admin">Admin</option>
                        <option value="leader">Leader</option>
                        <option value="member">Member</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteClick(user)}
                        disabled={user.id === currentUser.id}
                        className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed p-2 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                      >
                        <Trash2 size={16} /> <span className="text-xs font-bold">Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Delete User Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-brand-secondary/30"
            >
              <h3 className="text-lg font-bold text-brand-dark mb-2">Delete User</h3>
              <p className="text-brand-dark/70 text-sm mb-4">
                This action cannot be undone. To confirm, please type the username (<strong>{userToDelete.username}</strong>) below:
              </p>
              <input 
                type="text" 
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-brand-secondary/50 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                placeholder={userToDelete.username}
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => { setUserToDelete(null); setDeleteConfirmText(''); }} className="px-4 py-2 text-sm font-medium text-brand-dark/70 hover:text-brand-dark">Cancel</button>
                <button 
                  onClick={confirmDelete}
                  disabled={deleteConfirmText !== userToDelete.username}
                  className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Delete User
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'payments' | 'transportation' | 'installation' | 'sop'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [filterCarrier, setFilterCarrier] = useState<string>('');
  const [filterContractor, setFilterContractor] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setCurrentUser(userDoc.data() as AppUser);
          } else {
            // Fallback if user doc doesn't exist yet but they are logged in
            setCurrentUser({
              id: user.uid,
              username: user.email?.split('@')[0] || 'user',
              name: user.displayName || 'Unknown User',
              role: 'member'
            });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !currentUser) return;

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: AppUser[] = [];
      snapshot.forEach((doc) => usersData.push(doc.data() as AppUser));
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      const projectsData: Project[] = [];
      snapshot.forEach((doc) => projectsData.push(doc.data() as Project));
      setProjects(projectsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeProjects();
    };
  }, [isAuthReady, currentUser]);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  const handleUpdateProject = async (updatedProject: Project, oldId?: string) => {
    try {
      if (oldId && oldId !== updatedProject.id) {
        await setDoc(doc(db, 'projects', updatedProject.id), updatedProject as any);
        await deleteDoc(doc(db, 'projects', oldId));
        setSelectedProjectId(updatedProject.id);
      } else {
        await updateDoc(doc(db, 'projects', updatedProject.id), updatedProject as any);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${updatedProject.id}`);
    }
  };

  const handleAddProject = async () => {
    const newProject: Project = {
      id: `SO-${Math.floor(Math.random() * 10000)}`,
      name: 'New Project',
      customer: '',
      serialNumber: '',
      drawingNumber: '',
      unitType: '',
      kv: '',
      mva: '',
      currentStage: 'Manufacturing',
      origin: '',
      destination: '',
      startDate: '-',
      estFinalDelivery: '-',
      oceanFreight: { 
        fobDate: '-', cifDate: '-', etd: '-', eta: '-', atd: '-', ata: '-', 
        documents: [
          { name: 'B/L', received: false },
          { name: 'ISF', received: false },
          { name: 'Arrival Notice', received: false },
          { name: 'CIPL', received: false },
          { name: 'COO', received: false }
        ] 
      },
      inlandTransport: { ddpDate: '-', carrier: '', dischargingMethod: '', etd: '-', eta: '-', atd: '-', ata: '-', siteVisit: '-', railClearance: false, roadPermit: false, podReceived: false },
      installation: { startDate: '-', endDate: '-', contractor: '', supervisor: '', oilTotalReq: '', oilDeliveries: [], completionReport: false },
      assignedTo: currentUser?.role === 'leader' ? null : (currentUser?.id || null),
      logs: []
    };
    try {
      await setDoc(doc(db, 'projects', newProject.id), newProject);
      setSelectedProjectId(newProject.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${newProject.id}`);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      if (selectedProjectId === id) setSelectedProjectId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
    }
  };

  const roleFilteredProjects = projects.filter(p => currentUser?.role === 'leader' || currentUser?.role === 'admin' || p.assignedTo === currentUser?.id);

  const filteredProjects = roleFilteredProjects.filter(p => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(query);
      const matchId = p.id.toLowerCase().includes(query);
      if (!matchName && !matchId) return false;
    }
    if (filterCustomer && p.customer !== filterCustomer) return false;
    if (activeTab !== 'payments') {
      if (filterCarrier && p.inlandTransport.carrier !== filterCarrier) return false;
      if (filterContractor && p.installation.contractor !== filterContractor) return false;
    }
    return true;
  });

  const uniqueCustomers = Array.from(new Set(roleFilteredProjects.map(p => p.customer).filter(Boolean)));
  const uniqueCarriers = Array.from(new Set(roleFilteredProjects.map(p => p.inlandTransport.carrier).filter(Boolean)));
  const uniqueContractors = Array.from(new Set(roleFilteredProjects.map(p => p.installation.contractor).filter(Boolean)));
  const allCustomers = Array.from(new Set(projects.map(p => p.customer).filter(Boolean))) as string[];

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-brand-light font-sans text-brand-dark">Loading...</div>;
  }

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  if (currentUser.role === 'admin') {
    return <AdminDashboard users={users} currentUser={currentUser} onLogout={() => { signOut(auth); setCurrentUser(null); setSelectedProjectId(null); }} />;
  }

  return (
    <div className="min-h-screen flex font-sans bg-brand-light text-brand-dark">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-dark text-brand-light flex flex-col shrink-0">
        <div className="p-6 h-[88px]"></div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSelectedProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'dashboard' && !selectedProject ? 'bg-brand-muted/30 font-medium' : 'hover:bg-brand-muted/20 opacity-80 hover:opacity-100'}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            onClick={() => { setActiveTab('projects'); setSelectedProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${(activeTab === 'projects' || selectedProject) ? 'bg-brand-muted/30 font-medium' : 'hover:bg-brand-muted/20 opacity-80 hover:opacity-100'}`}
          >
            <FolderKanban size={20} />
            Projects
          </button>
          <button 
            onClick={() => { setActiveTab('transportation'); setSelectedProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'transportation' && !selectedProject ? 'bg-brand-muted/30 font-medium' : 'hover:bg-brand-muted/20 opacity-80 hover:opacity-100'}`}
          >
            <Truck size={20} />
            Transportation
          </button>
          <button 
            onClick={() => { setActiveTab('installation'); setSelectedProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'installation' && !selectedProject ? 'bg-brand-muted/30 font-medium' : 'hover:bg-brand-muted/20 opacity-80 hover:opacity-100'}`}
          >
            <Wrench size={20} />
            Installation
          </button>
          <button 
            onClick={() => { setActiveTab('payments'); setSelectedProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'payments' && !selectedProject ? 'bg-brand-muted/30 font-medium' : 'hover:bg-brand-muted/20 opacity-80 hover:opacity-100'}`}
          >
            <CreditCard size={20} />
            Payments
          </button>
          <button 
            onClick={() => { setActiveTab('sop'); setSelectedProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'sop' && !selectedProject ? 'bg-brand-muted/30 font-medium' : 'hover:bg-brand-muted/20 opacity-80 hover:opacity-100'}`}
          >
            <BookOpen size={20} />
            SOP Manual
          </button>
        </nav>

        <div className="p-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-brand-muted/20 opacity-80 hover:opacity-100 transition-colors">
            <Settings size={20} />
            Settings
          </button>
          <button 
            onClick={() => { setCurrentUser(null); setSelectedProjectId(null); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-brand-light/50 backdrop-blur-md border-b border-brand-secondary/30 flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-3 text-brand-dark/80 font-medium bg-white/50 px-4 py-2 rounded-lg border border-brand-secondary/30">
            <Calendar size={18} className="text-brand-secondary" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleAddProject} className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-brand-light rounded-lg font-medium text-sm hover:bg-brand-dark/90 transition-colors shadow-sm">
              <Plus size={16} /> New Project
            </button>
            <button className="p-2 rounded-full hover:bg-brand-muted/15 relative text-brand-dark/70">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-brand-light"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-brand-dark text-brand-light flex items-center justify-center font-medium text-sm">
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto px-4 sm:px-8 pb-8">
          <div className="pt-8">
            {!selectedProject && (
              <div className="w-full mx-auto mb-6 flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-brand-secondary/30">
              <div className="flex items-center gap-2 text-brand-dark/80 font-medium text-sm">
                <Filter size={16} /> Filters:
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-secondary" />
                <input 
                  type="text" 
                  placeholder="Search project name or SO#..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 w-64 bg-brand-muted/15 border border-brand-secondary/30 rounded-lg text-sm text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-dark placeholder:text-brand-secondary"
                />
              </div>
              <select 
                value={filterCustomer} 
                onChange={e => setFilterCustomer(e.target.value)}
                className="px-3 py-1.5 bg-brand-muted/15 border border-brand-secondary/30 rounded-lg text-sm text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-dark"
              >
                <option value="">All Customers</option>
                {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {activeTab !== 'payments' && activeTab !== 'sop' && (
                <>
                  {activeTab === 'installation' ? (
                    <select 
                      value={filterContractor} 
                      onChange={e => setFilterContractor(e.target.value)}
                      className="px-3 py-1.5 bg-brand-muted/15 border border-brand-secondary/30 rounded-lg text-sm text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-dark"
                    >
                      <option value="">All Installation Contractors</option>
                      {uniqueContractors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <select 
                      value={filterCarrier} 
                      onChange={e => setFilterCarrier(e.target.value)}
                      className="px-3 py-1.5 bg-brand-muted/15 border border-brand-secondary/30 rounded-lg text-sm text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-dark"
                    >
                      <option value="">All Transportation Vendors</option>
                      {uniqueCarriers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </>
              )}
              {(searchQuery || filterCustomer || (activeTab !== 'payments' && activeTab !== 'sop' && (filterCarrier || filterContractor))) && (
                <button 
                  onClick={() => { setSearchQuery(''); setFilterCustomer(''); setFilterCarrier(''); setFilterContractor(''); }}
                  className="text-xs font-medium text-brand-secondary hover:text-brand-dark"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
          <AnimatePresence mode="wait">
            {selectedProject ? (
              <ProjectDetail 
                key="detail" 
                project={selectedProject} 
                currentUser={currentUser}
                users={users}
                allCustomers={allCustomers}
                onBack={() => setSelectedProjectId(null)} 
                onUpdate={handleUpdateProject}
                onDelete={() => handleDeleteProject(selectedProject.id)}
              />
            ) : activeTab === 'dashboard' ? (
              <Dashboard key="dashboard" projects={filteredProjects} onSelectProject={(p) => setSelectedProjectId(p.id)} />
            ) : activeTab === 'projects' ? (
              <ProjectList key="list" projects={filteredProjects} onSelectProject={(p) => setSelectedProjectId(p.id)} />
            ) : activeTab === 'transportation' ? (
              <TransportationView key="transportation" projects={filteredProjects} onUpdateProject={handleUpdateProject} />
            ) : activeTab === 'installation' ? (
              <InstallationView key="installation" projects={filteredProjects} onUpdateProject={handleUpdateProject} />
            ) : activeTab === 'sop' ? (
              <SOPView key="sop" />
            ) : (
              <PaymentsView key="payments" projects={filteredProjects} onUpdateProject={handleUpdateProject} />
            )}
          </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function getClosestDateInfo(project: Project) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowTime = now.getTime();
  const dates: { label: string, dateStr: string, diff: number, isFuture: boolean }[] = [];

  const addDate = (label: string, dateStr: string) => {
    if (dateStr && dateStr !== '-') {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      const time = d.getTime();
      if (!isNaN(time)) {
        dates.push({ label, dateStr, diff: Math.abs(time - nowTime), isFuture: time >= nowTime });
      }
    }
  };

  addDate('Ocean Freight ETD', project.oceanFreight.etd);
  addDate('Ocean Freight ETA', project.oceanFreight.eta);
  addDate('Inland Transport ETD', project.inlandTransport.etd);
  addDate('Inland Transport ETA', project.inlandTransport.eta);
  addDate('Installation Start', project.installation.startDate);
  addDate('Installation End', project.installation.endDate);

  if (dates.length === 0) return null;
  
  // Sort by future first, then by diff
  dates.sort((a, b) => {
    if (a.isFuture && !b.isFuture) return -1;
    if (!a.isFuture && b.isFuture) return 1;
    return a.diff - b.diff;
  });
  
  return dates[0];
}

function Dashboard({ projects, onSelectProject }: { projects: Project[], onSelectProject: (p: Project) => void, key?: string }) {
  const projectsWithDates = projects.map(p => {
    const closestDate = getClosestDateInfo(p);
    return { project: p, closestDate };
  }).filter(p => p.closestDate !== null);

  projectsWithDates.sort((a, b) => {
    const aDate = a.closestDate!;
    const bDate = b.closestDate!;
    if (aDate.isFuture && !bDate.isFuture) return -1;
    if (!aDate.isFuture && bDate.isFuture) return 1;
    return aDate.diff - bDate.diff;
  });

  const topProjects = projectsWithDates.slice(0, 10);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8 w-full mx-auto"
    >
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-brand-dark/80 mt-1">Top 10 projects with the closest upcoming events.</p>
      </div>
      
      <div className="flex flex-col gap-4">
        {topProjects.map(({ project, closestDate }, index) => (
          <div 
            key={project.id} 
            onClick={() => onSelectProject(project)}
            className="bg-white rounded-2xl p-5 shadow-sm border border-brand-secondary/30 cursor-pointer hover:shadow-md hover:border-brand-dark/30 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="flex items-center gap-6 flex-1">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-muted/15 flex items-center justify-center text-brand-secondary font-bold text-lg">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {project.unitType && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-dark/10 text-brand-dark border border-brand-secondary/50 inline-block">
                      {project.unitType}
                    </span>
                  )}
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-dark text-brand-light inline-block">
                    {project.id}
                  </span>
                </div>
                <h4 className="font-bold text-lg leading-tight group-hover:text-brand-dark/80 transition-colors truncate">{project.name}</h4>
                <p className="text-sm text-brand-dark/80 truncate">{project.customer} • {project.destination}</p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12 w-full md:w-auto">
              {/* Stage Info */}
              <div className="flex flex-col gap-1 min-w-[150px]">
                <span className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Current Stage</span>
                <span className="font-semibold text-brand-dark">{project.currentStage}</span>
              </div>
              
              {/* Date Info */}
              {closestDate ? (
                <div className="flex flex-col gap-1 min-w-[200px]">
                  <span className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Next Milestone</span>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className={closestDate.isFuture ? "text-emerald-600" : "text-brand-secondary"} />
                    <span className="text-sm font-medium text-brand-dark/70">{closestDate.label}</span>
                  </div>
                  <span className={`font-bold ${closestDate.isFuture ? "text-emerald-600" : "text-brand-secondary"}`}>
                    {closestDate.dateStr}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1 min-w-[200px]">
                  <span className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Next Milestone</span>
                  <span className="text-sm font-medium text-brand-secondary">No upcoming dates</span>
                </div>
              )}
              
              <button className="text-brand-secondary hover:text-brand-dark hidden md:block">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Editable Components
function EditableText({ isEditing, value, onChange, className = "", placeholder = "", list = [] }: any) {
  const id = useId();
  if (!isEditing) return <span className={className}>{value}</span>;
  return (
    <>
      <input 
        type="text" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className={`w-full px-3 py-1.5 bg-brand-muted/15 border border-brand-secondary/30 rounded-lg text-brand-dark text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-dark/30 transition-all ${className}`} 
        placeholder={placeholder}
        list={list.length > 0 ? id : undefined}
      />
      {list.length > 0 && (
        <datalist id={id}>
          {list.map((opt: string) => <option key={opt} value={opt} />)}
        </datalist>
      )}
    </>
  );
}

function EditableDate({ isEditing, value, onChange, className = "" }: any) {
  if (!isEditing) return <span className={className}>{value}</span>;
  return (
    <input 
      type="date" 
      value={value === '-' ? '' : value} 
      onChange={e => onChange(e.target.value || '-')} 
      className={`w-full px-3 py-1.5 bg-brand-muted/15 border border-brand-secondary/30 rounded-lg text-brand-dark text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-dark/30 transition-all ${className}`} 
    />
  );
}

function EditableSelect({ isEditing, value, options, onChange, className = "" }: any) {
  if (!isEditing) return <span className={className}>{value}</span>;
  return (
    <div className="relative w-full">
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className={`w-full px-3 py-1.5 bg-brand-muted/15 border border-brand-secondary/30 rounded-lg text-brand-dark text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-dark/30 transition-all appearance-none pr-8 ${className}`}
      >
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-secondary pointer-events-none" />
    </div>
  );
}

function EditableCombobox({ isEditing, value, options, onChange, placeholder = "", className = "" }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isEditing) return <span className={className}>{value}</span>;

  const filteredOptions = options.filter((opt: string) => opt.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`w-full px-3 py-1.5 bg-brand-muted/15 border border-brand-secondary/30 rounded-lg text-brand-dark text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-dark/30 transition-all pr-8 ${className}`}
      />
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-secondary pointer-events-none" />
      <AnimatePresence>
        {isOpen && filteredOptions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-white border border-brand-secondary/30 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1"
          >
            {filteredOptions.map((opt: string) => (
              <div
                key={opt}
                className="px-3 py-2 text-sm text-brand-dark hover:bg-brand-muted/15 cursor-pointer"
                onClick={() => {
                  setInputValue(opt);
                  onChange(opt);
                  setIsOpen(false);
                }}
              >
                {opt}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const formatDateRange = (start?: string, end?: string) => {
  const s = start && start !== '-' ? start : '';
  const e = end && end !== '-' ? end : '';
  if (!s && !e) return undefined;
  return `${s || '?'} ~ ${e || '?'}`;
};

const getBestDate = (actual?: string, estimated?: string) => {
  if (actual && actual !== '-') return actual;
  if (estimated && estimated !== '-') return estimated;
  return undefined;
};

const getDeliveryLabel = (i: number) => {
  const labels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  return `${labels[i] || (i + 1) + 'th'} Delivery`;
};

function ProjectDetail({ project, currentUser, users, allCustomers, onBack, onUpdate, onDelete }: { project: Project, currentUser: AppUser, users: AppUser[], allCustomers: string[], onBack: () => void, onUpdate: (p: Project, oldId?: string) => void, onDelete: () => void, key?: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'logs'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Project>(project);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  useEffect(() => {
    setEditData(project);
  }, [project]);

  const handleSave = () => {
    const dataToSave = { ...editData };
    if (!dataToSave.id.trim()) {
      dataToSave.id = project.id;
    }
    onUpdate(dataToSave, project.id);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(project);
    setIsEditing(false);
  };

  const updateField = (path: string[], value: any) => {
    setEditData(prev => {
      const newData = JSON.parse(JSON.stringify(prev)); // deep copy for simplicity
      let current = newData;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newData;
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteInput === project.id) {
      onDelete();
    }
  };

  const stageOptions: Stage[] = ['Manufacturing', 'Ocean Freight', 'Inland Transport', 'Installation', 'Commissioning'];

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-full mx-auto flex flex-col gap-6 relative"
      >
      {/* Header */}
      <button 
        onClick={onBack}
        className="w-fit flex items-center gap-2 text-sm font-medium text-brand-secondary hover:text-brand-dark hover:bg-brand-muted/15 px-3 py-1.5 -ml-3 -mb-2 rounded-lg transition-colors"
      >
        <ArrowLeft size={16} /> Back to Projects
      </button>
      <div className="bg-white rounded-xl p-6 md:p-8 shadow-md border border-brand-secondary/30 flex flex-col lg:flex-row lg:items-start justify-between gap-6 sticky top-0 z-40">
          <div className="flex-1 w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <EditableText isEditing={isEditing} value={editData.name} onChange={(v: string) => updateField(['name'], v)} className="text-3xl font-bold text-brand-dark leading-tight" />
                ) : (
                  <h2 className="text-3xl font-bold text-brand-dark leading-tight truncate">{project.name}</h2>
                )}
              </div>
              {isEditing ? (
                <div className="flex gap-2">
                  <select
                    value={editData.unitType || ''}
                    onChange={e => updateField(['unitType'], e.target.value)}
                    className="text-sm font-bold px-3 py-1.5 rounded-lg bg-brand-dark/10 text-brand-dark border border-brand-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                  >
                    <option value="">Unit Type</option>
                    <option value="HDE">HDE</option>
                    <option value="HPT">HPT</option>
                  </select>
                  <input 
                    type="text" 
                    value={editData.id} 
                    onChange={e => updateField(['id'], e.target.value)} 
                    className="text-sm font-bold px-3 py-1.5 rounded-lg bg-brand-dark text-brand-light w-full sm:w-32 focus:outline-none focus:ring-2 focus:ring-brand-dark/50 shrink-0"
                  />
                </div>
              ) : (
                <div className="flex gap-2">
                  {project.unitType && (
                    <span className="text-sm font-bold px-3 py-1.5 rounded-lg bg-brand-dark/10 text-brand-dark border border-brand-secondary/50 shrink-0 w-fit">
                      {project.unitType}
                    </span>
                  )}
                  <span className="text-sm font-bold px-3 py-1.5 rounded-lg bg-brand-dark text-brand-light shrink-0 w-fit">
                    {project.id}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 text-brand-dark/80 text-[15px] mb-5">
              <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-[180px]">
                <EditableCombobox isEditing={isEditing} value={editData.customer} onChange={(v: string) => updateField(['customer'], v)} placeholder="Customer" options={allCustomers} />
              </div>
              <span className="hidden sm:inline text-brand-dark/30">•</span>
              <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-[180px]">
                <User size={16} className="shrink-0" />
                {isEditing && currentUser.role === 'leader' ? (
                  <div className="relative w-full">
                    <select 
                      value={editData.assignedTo || ''} 
                      onChange={e => updateField(['assignedTo'], e.target.value || null)}
                      className="bg-brand-muted/15 border border-brand-secondary/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 w-full text-[15px] text-brand-dark appearance-none pr-8"
                    >
                      <option value="">Unassigned</option>
                      {users.filter(u => u.role === 'member').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-secondary pointer-events-none" />
                  </div>
                ) : (
                  <span className="truncate">{users.find(u => u.id === project.assignedTo)?.name || 'Unassigned'}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-brand-secondary/30 rounded-lg text-sm font-medium text-brand-dark/70 flex-1 min-w-[220px]">
                <Factory size={16} className="text-brand-secondary shrink-0" />
                <span className="shrink-0">SERIAL#:</span> 
                <div className="flex-1 min-w-0">
                  <EditableText isEditing={isEditing} value={editData.serialNumber} onChange={(v: string) => updateField(['serialNumber'], v)} className="text-brand-dark font-bold w-full" />
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-brand-secondary/30 rounded-lg text-sm font-medium text-brand-dark/70 flex-1 min-w-[220px]">
                <FileText size={16} className="text-brand-secondary shrink-0" />
                <span className="shrink-0">DRAWING#:</span> 
                <div className="flex-1 min-w-0">
                  <EditableText isEditing={isEditing} value={editData.drawingNumber} onChange={(v: string) => updateField(['drawingNumber'], v)} className="text-brand-dark font-bold w-full" />
                </div>
              </div>
            </div>
          </div>
        
        <div className="flex flex-row flex-wrap items-center gap-3 shrink-0">
          {isEditing ? (
            <>
              <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-secondary/50 rounded-lg font-medium text-sm text-brand-dark hover:bg-brand-muted/15 transition-colors shadow-sm">
                <X size={16} /> Cancel
              </button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-brand-light rounded-lg font-medium text-sm hover:bg-brand-dark/90 transition-colors shadow-sm">
                <Save size={16} /> Save Changes
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium text-sm hover:bg-red-100 transition-colors shadow-sm">
                <Trash2 size={16} /> Delete
              </button>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-secondary/50 rounded-lg font-medium text-sm text-brand-dark hover:bg-brand-muted/15 transition-colors shadow-sm">
                <Edit3 size={16} /> Edit
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm border border-brand-secondary/30 relative overflow-hidden flex flex-col gap-8">
        {isEditing && (
          <div className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-3 text-sm z-20">
            <span className="font-medium text-brand-dark/80">Current Stage:</span>
            <div className="w-full sm:w-64">
              <EditableSelect isEditing={isEditing} value={editData.currentStage} options={stageOptions} onChange={(v: Stage) => updateField(['currentStage'], v)} className="font-bold" />
            </div>
          </div>
        )}
        <div className="relative">
          <div className="absolute top-1/2 left-12 right-12 h-0.5 bg-brand-dark/10 -translate-y-1/2 -z-0" />
          <div className="flex justify-between relative z-10">
            <StepIndicator title="Manufacturing" icon={Factory} status={getStepStatus('Manufacturing', editData.currentStage)} />
            <StepIndicator title="Ocean Freight" icon={Ship} status={getStepStatus('Ocean Freight', editData.currentStage)} date={formatDateRange(getBestDate(editData.oceanFreight.atd, editData.oceanFreight.etd), getBestDate(editData.oceanFreight.ata, editData.oceanFreight.eta))} />
            <StepIndicator title="Inland Transport" icon={Truck} status={getStepStatus('Inland Transport', editData.currentStage)} date={formatDateRange(getBestDate(editData.inlandTransport.atd, editData.inlandTransport.etd), getBestDate(editData.inlandTransport.ata, editData.inlandTransport.eta))} />
            <StepIndicator title="Installation" icon={Wrench} status={getStepStatus('Installation', editData.currentStage)} date={formatDateRange(editData.installation.startDate, editData.installation.endDate)} />
            <StepIndicator title="Commissioning" icon={PlayCircle} status={getStepStatus('Commissioning', editData.currentStage)} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Details */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Tabs */}
          <div className="flex border-b border-brand-secondary/30">
            <button 
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-brand-dark text-brand-dark' : 'border-transparent text-brand-secondary hover:text-brand-dark'}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-brand-dark text-brand-dark' : 'border-transparent text-brand-secondary hover:text-brand-dark'}`}
              onClick={() => setActiveTab('tasks')}
            >
              Tasks
            </button>
            <button 
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'logs' ? 'border-brand-dark text-brand-dark' : 'border-transparent text-brand-secondary hover:text-brand-dark'}`}
              onClick={() => setActiveTab('logs')}
            >
              Logs
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top 4 Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoCard label="ORIGIN" value={editData.origin} icon={MapPin} isEditing={isEditing} onChange={(v: string) => updateField(['origin'], v)} />
                <InfoCard label="DESTINATION" value={editData.destination} icon={MapPin} isEditing={isEditing} onChange={(v: string) => updateField(['destination'], v)} />
                <InfoCard label="START DATE" value={editData.startDate} icon={Calendar} isEditing={isEditing} onChange={(v: string) => updateField(['startDate'], v)} type="date" />
                <InfoCard label="EST. FINAL DELIVERY" value={editData.estFinalDelivery} icon={Calendar} isEditing={isEditing} onChange={(v: string) => updateField(['estFinalDelivery'], v)} type="date" />
              </div>

              {/* Ocean Transportation */}
              <div className="bg-white rounded-xl shadow-sm border border-brand-secondary/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-brand-dark/5 flex flex-col sm:flex-row sm:items-center justify-between bg-brand-muted/15 gap-4">
                  <div className="flex items-center gap-2 font-bold text-brand-dark">
                    <Ship size={18} className="text-brand-dark" />
                    Ocean Transportation
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-brand-dark/80">
                    <div className="flex items-center gap-2">FOB Date: <EditableDate isEditing={isEditing} value={editData.oceanFreight.fobDate} onChange={(v: string) => updateField(['oceanFreight', 'fobDate'], v)} className="font-medium text-brand-dark bg-white px-2 py-1 rounded border border-brand-secondary/30" /></div>
                    <div className="flex items-center gap-2">CIF Date: <EditableDate isEditing={isEditing} value={editData.oceanFreight.cifDate} onChange={(v: string) => updateField(['oceanFreight', 'cifDate'], v)} className="font-medium text-brand-dark bg-white px-2 py-1 rounded border border-brand-secondary/30" /></div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
                    <DateItem label="Est. Departure (ETD)" value={editData.oceanFreight.etd} isEditing={isEditing} onChange={(v: string) => updateField(['oceanFreight', 'etd'], v)} />
                    <DateItem label="Est. Arrival (ETA)" value={editData.oceanFreight.eta} isEditing={isEditing} onChange={(v: string) => updateField(['oceanFreight', 'eta'], v)} />
                    <DateItem label="Act. Departure (ATD)" value={editData.oceanFreight.atd} highlight isEditing={isEditing} onChange={(v: string) => updateField(['oceanFreight', 'atd'], v)} />
                    <DateItem label="Act. Arrival (ATA)" value={editData.oceanFreight.ata} highlight isEditing={isEditing} onChange={(v: string) => updateField(['oceanFreight', 'ata'], v)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-brand-secondary mb-3 uppercase tracking-wider">
                      <FileText size={14} /> Documents Received
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editData.oceanFreight.documents.map((doc, idx) => (
                        <React.Fragment key={doc.name}>
                          {isEditing ? (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${doc.received ? 'bg-brand-dark text-brand-light border-brand-dark shadow-sm' : 'bg-brand-muted/15 text-brand-dark/80 border-brand-secondary/50'}`}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={doc.received} 
                                  onChange={e => {
                                    const newDocs = [...editData.oceanFreight.documents];
                                    newDocs[idx].received = e.target.checked;
                                    updateField(['oceanFreight', 'documents'], newDocs);
                                  }} 
                                  className={`w-3.5 h-3.5 rounded-sm cursor-pointer ${doc.received ? 'accent-brand-light' : 'accent-brand-dark'}`} 
                                />
                                {doc.name}
                              </label>
                              <input 
                                type="date" 
                                value={doc.date || ''} 
                                onChange={e => {
                                  const newDocs = [...editData.oceanFreight.documents];
                                  newDocs[idx].date = e.target.value;
                                  updateField(['oceanFreight', 'documents'], newDocs);
                                }}
                                className={`ml-2 px-1 py-0.5 rounded text-xs focus:outline-none focus:ring-1 w-28 ${doc.received ? 'bg-brand-light/20 text-brand-light focus:ring-brand-light' : 'bg-white text-brand-dark focus:ring-brand-dark/30 border border-brand-secondary/50'}`}
                              />
                            </div>
                          ) : (
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium border ${doc.received ? 'bg-brand-dark text-brand-light border-brand-dark shadow-sm' : 'bg-white text-brand-secondary border-brand-secondary/50'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${doc.received ? 'bg-brand-light' : 'bg-brand-dark/20'}`} />
                              {doc.name}
                              {doc.date && <span className="ml-1 opacity-70 text-xs">({doc.date})</span>}
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inland Transportation */}
              <div className="bg-white rounded-xl shadow-sm border border-brand-secondary/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-brand-dark/5 flex flex-col sm:flex-row sm:items-center justify-between bg-brand-muted/15 gap-4">
                  <div className="flex items-center gap-2 font-bold text-brand-dark">
                    <Truck size={18} className="text-brand-dark" />
                    Inland Transportation
                  </div>
                  <div className="flex items-center gap-4 text-xs text-brand-dark/80">
                    <div className="flex items-center gap-2">DDP Date: <EditableDate isEditing={isEditing} value={editData.inlandTransport.ddpDate} onChange={(v: string) => updateField(['inlandTransport', 'ddpDate'], v)} className="font-medium text-brand-dark bg-white px-2 py-1 rounded border border-brand-secondary/30" /></div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div>
                      <div className="text-xs text-brand-secondary mb-1">Transportation Vendor</div>
                      <EditableText isEditing={isEditing} value={editData.inlandTransport.carrier} onChange={(v: string) => updateField(['inlandTransport', 'carrier'], v)} className="font-medium text-brand-dark" />
                    </div>
                    <div>
                      <div className="text-xs text-brand-secondary mb-1">Discharging Method</div>
                      <EditableSelect isEditing={isEditing} value={editData.inlandTransport.dischargingMethod} options={['Rail', 'Trailer', 'Barge']} onChange={(v: string) => updateField(['inlandTransport', 'dischargingMethod'], v)} className="font-medium text-brand-dark" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
                    <DateItem label="Est. Departure" value={editData.inlandTransport.etd} isEditing={isEditing} onChange={(v: string) => updateField(['inlandTransport', 'etd'], v)} />
                    <DateItem label="Est. Arrival" value={editData.inlandTransport.eta} isEditing={isEditing} onChange={(v: string) => updateField(['inlandTransport', 'eta'], v)} />
                    <DateItem label="Act. Departure" value={editData.inlandTransport.atd} highlight isEditing={isEditing} onChange={(v: string) => updateField(['inlandTransport', 'atd'], v)} />
                    <DateItem label="Act. Arrival" value={editData.inlandTransport.ata} highlight isEditing={isEditing} onChange={(v: string) => updateField(['inlandTransport', 'ata'], v)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-brand-dark/5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-brand-dark/80">Site Visit:</span>
                      <EditableDate isEditing={isEditing} value={editData.inlandTransport.siteVisit} onChange={(v: string) => updateField(['inlandTransport', 'siteVisit'], v)} className="font-medium text-brand-dark bg-brand-muted/15 px-2 py-1 rounded border border-brand-secondary/30" />
                    </div>
                    <CheckboxItem label="Road Permit" checked={editData.inlandTransport.roadPermit} isEditing={isEditing} onChange={(v: boolean) => updateField(['inlandTransport', 'roadPermit'], v)} />
                    <CheckboxItem label="POD Received" checked={editData.inlandTransport.podReceived} isEditing={isEditing} onChange={(v: boolean) => updateField(['inlandTransport', 'podReceived'], v)} />
                  </div>
                  <div className="pt-4 mt-4 border-t border-brand-dark/5">
                    <div className="text-xs text-brand-secondary mb-1">Site Contact</div>
                    {isEditing ? (
                      <textarea 
                        value={editData.inlandTransport.siteContact || ''}
                        onChange={(e) => updateField(['inlandTransport', 'siteContact'], e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-brand-secondary/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 transition-shadow min-h-[80px] resize-y"
                        placeholder="Enter site contact details (multiple contacts allowed)..."
                      />
                    ) : (
                      <div className="text-sm text-brand-dark whitespace-pre-wrap">
                        {editData.inlandTransport.siteContact || '-'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Installation & Assembly */}
              <div className="bg-white rounded-xl shadow-sm border border-brand-secondary/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-brand-dark/5 flex flex-col sm:flex-row sm:items-center justify-between bg-brand-muted/15 gap-4">
                  <div className="flex items-center gap-2 font-bold text-brand-dark">
                    <Wrench size={18} className="text-brand-dark" />
                    Installation & Assembly
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-brand-dark/80">
                    <div className="flex items-center gap-2">Start: <EditableDate isEditing={isEditing} value={editData.installation.startDate} onChange={(v: string) => updateField(['installation', 'startDate'], v)} className="font-medium text-brand-dark bg-white px-2 py-1 rounded border border-brand-secondary/30" /></div>
                    <div className="flex items-center gap-2">End: <EditableDate isEditing={isEditing} value={editData.installation.endDate} onChange={(v: string) => updateField(['installation', 'endDate'], v)} className="font-medium text-brand-dark bg-white px-2 py-1 rounded border border-brand-secondary/30" /></div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div>
                      <div className="text-xs text-brand-secondary mb-1">Installation Vendor</div>
                      <EditableText isEditing={isEditing} value={editData.installation.contractor} onChange={(v: string) => updateField(['installation', 'contractor'], v)} className="font-medium text-brand-dark" />
                    </div>
                    <div>
                      <div className="text-xs text-brand-secondary mb-1 flex items-center gap-1"><Activity size={12}/> Supervisor</div>
                      <EditableText isEditing={isEditing} value={editData.installation.supervisor} onChange={(v: string) => updateField(['installation', 'supervisor'], v)} className="font-medium text-brand-dark" />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-brand-dark/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Oil Delivery Schedule</div>
                      <div className="text-xs text-brand-dark/80 flex items-center gap-2">
                        Total Req: <EditableText isEditing={isEditing} value={editData.installation.oilTotalReq} onChange={(v: string) => updateField(['installation', 'oilTotalReq'], v)} className="font-bold text-brand-dark w-24" />
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      {editData.installation.oilDeliveries.map((delivery, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-brand-muted/15 rounded-lg border border-brand-dark/5 text-sm gap-2">
                          <div className="font-medium text-brand-dark/80 w-24 shrink-0">{getDeliveryLabel(i)}</div>
                          <div className="flex items-center gap-4 text-brand-dark/80">
                            <span className="flex items-center gap-1">
                              <Calendar size={14}/> 
                              <EditableDate isEditing={isEditing} value={delivery.date} onChange={(v: string) => {
                                const newDel = [...editData.installation.oilDeliveries];
                                newDel[i].date = v;
                                updateField(['installation', 'oilDeliveries'], newDel);
                              }} />
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={14}/> 
                              <EditableText isEditing={isEditing} value={delivery.time} onChange={(v: string) => {
                                const newDel = [...editData.installation.oilDeliveries];
                                newDel[i].time = v;
                                updateField(['installation', 'oilDeliveries'], newDel);
                              }} className="w-20" />
                            </span>
                            {isEditing && (
                              <button 
                                onClick={() => {
                                  const newDel = editData.installation.oilDeliveries.filter((_, idx) => idx !== i);
                                  updateField(['installation', 'oilDeliveries'], newDel);
                                }} 
                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {isEditing && (
                        <button 
                          onClick={() => {
                            const newDel = [...editData.installation.oilDeliveries, { name: '', date: '-', time: '00:00' }];
                            updateField(['installation', 'oilDeliveries'], newDel);
                          }}
                          className="w-full py-2 border border-dashed border-brand-dark/30 rounded-lg text-brand-dark/80 hover:text-brand-dark hover:border-brand-dark/50 flex items-center justify-center gap-2 text-sm transition-colors"
                        >
                          <Plus size={16} /> Add Delivery
                        </button>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <CheckboxItem label="Completion Report" checked={editData.installation.completionReport} isEditing={isEditing} onChange={(v: boolean) => updateField(['installation', 'completionReport'], v)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-brand-secondary/30 text-center text-brand-secondary">
              Tasks view is currently disabled.
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-brand-secondary/30 text-center text-brand-secondary">
              Detailed logs view.
            </div>
          )}
        </div>
      </div>
    </motion.div>

    {/* Delete Confirmation Modal */}
    <AnimatePresence>
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full border border-brand-secondary/30"
          >
            <h3 className="text-xl font-bold text-brand-dark mb-2">Delete Project</h3>
            <p className="text-brand-dark/70 text-sm mb-6">
              This action cannot be undone. To confirm deletion, please type the Project ID (<span className="font-bold text-brand-dark">{project.id}</span>) below.
            </p>
            <input 
              type="text" 
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={project.id}
              className="w-full px-4 py-2 mb-6 border border-brand-secondary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput('');
                }}
                className="px-4 py-2 text-sm font-medium text-brand-dark hover:bg-brand-muted/15 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConfirm}
                disabled={deleteInput !== project.id}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  deleteInput === project.id 
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm' 
                    : 'bg-red-100 text-red-400 cursor-not-allowed'
                }`}
              >
                <Trash2 size={16} />
                Confirm Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}

// Helpers
const STAGES: Stage[] = ['Manufacturing', 'Ocean Freight', 'Inland Transport', 'Installation', 'Commissioning'];

function getStepStatus(step: Stage, currentStage: Stage): 'completed' | 'active' | 'pending' {
  const currentIndex = STAGES.indexOf(currentStage);
  const stepIndex = STAGES.indexOf(step);
  
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

function StepIndicator({ title, icon: Icon, status, date }: { title: string, icon: any, status: 'completed' | 'active' | 'pending', date?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 bg-white px-2">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
        status === 'completed' ? 'bg-brand-dark border-brand-dark text-brand-light' :
        status === 'active' ? 'bg-brand-light border-brand-dark text-brand-dark' :
        'bg-white border-brand-secondary/50 text-brand-dark/30'
      }`}>
        {status === 'completed' ? <Check size={20} /> : <Icon size={20} />}
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className={`text-xs font-medium text-center ${status === 'active' ? 'text-brand-dark font-bold' : 'text-brand-secondary'}`}>
          {title}
        </span>
        {date && (
          <span className="text-xs font-mono font-bold text-brand-dark bg-brand-dark/10 px-2 py-1 rounded-md shadow-sm border border-brand-secondary/30">
            {date}
          </span>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon: Icon, isEditing, onChange, type = "text" }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-brand-secondary/30 shadow-sm flex flex-col gap-2">
      <div className="text-xs font-bold text-brand-secondary uppercase tracking-wider">{label}</div>
      <div className="flex items-center gap-2 text-brand-dark font-medium text-[15px]">
        <Icon size={16} className="text-brand-secondary shrink-0" />
        {type === 'date' ? (
          <EditableDate isEditing={isEditing} value={value} onChange={onChange} />
        ) : (
          <EditableText isEditing={isEditing} value={value} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

function DateItem({ label, value, highlight = false, isEditing, onChange }: any) {
  return (
    <div>
      <div className="text-xs text-brand-secondary mb-1">{label}</div>
      <div className={`font-medium text-[15px] ${highlight && value !== '-' && !isEditing ? 'text-brand-dark font-bold' : 'text-brand-dark'}`}>
        <EditableDate isEditing={isEditing} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function CheckboxItem({ label, checked, isEditing, onChange }: any) {
  if (isEditing) {
    return (
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-brand-dark w-4 h-4" />
        <span className="text-brand-dark">{label}</span>
      </label>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${checked ? 'bg-brand-dark border-brand-dark text-brand-light' : 'border-brand-secondary/50'}`}>
        {checked && <Check size={10} strokeWidth={3} />}
      </div>
      <span className={checked ? 'text-brand-dark' : 'text-brand-secondary'}>{label}</span>
    </div>
  );
}

function ProjectList({ projects, onSelectProject }: { projects: Project[], onSelectProject: (p: Project) => void, key?: string }) {
  return (
    <div className="w-full mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-brand-dark">All Projects</h2>
      <div className="bg-white rounded-xl shadow-sm border border-brand-secondary/30 overflow-hidden">
        {projects.map((p, index) => (
          <div key={p.id} onClick={() => onSelectProject(p)} className="p-4 border-b border-brand-dark/5 hover:bg-brand-muted/15 cursor-pointer text-brand-dark flex items-center gap-4">
            <span className="text-xs font-mono font-bold text-brand-secondary w-6">#{index + 1}</span>
            {p.unitType && (
              <span className="text-xs font-bold px-2 py-1 rounded bg-brand-dark/10 text-brand-dark border border-brand-secondary/50 shrink-0 w-12 text-center">
                {p.unitType}
              </span>
            )}
            <span className="text-xs font-bold px-2 py-1 rounded bg-brand-dark/10 text-brand-dark shrink-0 w-24 text-center">
              {p.id}
            </span>
            <span className="font-medium">{p.name}</span>
            <span className="text-sm text-brand-dark/80 ml-auto">{p.customer}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const calculateDueDate = (invoiceDate?: string, netTerms?: string) => {
  if (!invoiceDate || !netTerms) return '';
  const date = new Date(invoiceDate);
  if (isNaN(date.getTime())) return '';
  
  let days = 0;
  if (netTerms === 'Net 30 days') days = 30;
  else if (netTerms === 'Net 45 days') days = 45;
  else if (netTerms === 'Net 60 days') days = 60;
  
  if (days === 0) return '';
  
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

function ProjectPaymentCard({ project, onUpdateProject }: { project: Project, onUpdateProject: (p: Project) => void, key?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ProjectPaymentData | null>(null);

  useEffect(() => {
    setEditData(project.paymentMilestones || { totalRevenue: 0, totalCost: 0, milestones: [] });
  }, [project]);

  const handleSave = () => {
    if (editData) {
      onUpdateProject({ ...project, paymentMilestones: editData });
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditData(project.paymentMilestones || { totalRevenue: 0, totalCost: 0, milestones: [] });
    setIsEditing(false);
  };

  const updateMilestone = (index: number, field: keyof PaymentMilestone, value: any) => {
    if (!editData) return;
    const newMilestones = [...editData.milestones];
    const updatedMilestone = { ...newMilestones[index], [field]: value };
    
    if (field === 'customerStatus' || field === 'hqStatus') {
      if (updatedMilestone.customerStatus === 'Paid' && updatedMilestone.hqStatus === 'Paid') {
        updatedMilestone.isDone = true;
      } else if (updatedMilestone.isDone && (updatedMilestone.customerStatus !== 'Paid' || updatedMilestone.hqStatus !== 'Paid')) {
        updatedMilestone.isDone = false;
      }
    }

    if (field === 'customerInvoiceDate' || field === 'customerNetTerms') {
      const newDueDate = calculateDueDate(updatedMilestone.customerInvoiceDate, updatedMilestone.customerNetTerms);
      if (newDueDate) {
        updatedMilestone.customerDueDate = newDueDate;
      }
    }

    if (field === 'hqInvoiceDate' || field === 'hqNetTerms') {
      const newDueDate = calculateDueDate(updatedMilestone.hqInvoiceDate, updatedMilestone.hqNetTerms);
      if (newDueDate) {
        updatedMilestone.hqDueDate = newDueDate;
      }
    }
    
    newMilestones[index] = updatedMilestone;
    setEditData({ ...editData, milestones: newMilestones });
  };

  const addMilestone = () => {
    if (!editData) return;
    setEditData({
      ...editData,
      milestones: [
        ...editData.milestones,
        {
          id: Math.random().toString(36).substr(2, 9),
          name: 'New Milestone',
          isDone: false,
          customerAmount: 0,
          customerStatus: 'Pending',
          hqAmount: 0,
          hqStatus: 'Not Started'
        }
      ]
    });
  };

  const removeMilestone = (index: number) => {
    if (!editData) return;
    const newMilestones = [...editData.milestones];
    newMilestones.splice(index, 1);
    setEditData({ ...editData, milestones: newMilestones });
  };

  const quickUpdateStatus = (index: number, field: keyof PaymentMilestone, value: any) => {
    if (!project.paymentMilestones) return;
    const newMilestones = [...project.paymentMilestones.milestones];
    const updatedMilestone = { ...newMilestones[index], [field]: value };
    
    if (field === 'customerStatus' || field === 'hqStatus') {
      if (updatedMilestone.customerStatus === 'Paid' && updatedMilestone.hqStatus === 'Paid') {
        updatedMilestone.isDone = true;
      } else if (updatedMilestone.isDone && (updatedMilestone.customerStatus !== 'Paid' || updatedMilestone.hqStatus !== 'Paid')) {
        updatedMilestone.isDone = false;
      }
    }
    
    newMilestones[index] = updatedMilestone;
    const updatedPaymentData = { ...project.paymentMilestones, milestones: newMilestones };
    
    const updatedProject = { ...project, paymentMilestones: updatedPaymentData };
    onUpdateProject(updatedProject);
    
    if (editData) {
      const newEditMilestones = [...editData.milestones];
      newEditMilestones[index] = updatedMilestone;
      setEditData({ ...editData, milestones: newEditMilestones });
    }
  };

  const data = isEditing ? editData : project.paymentMilestones;
  const milestones = data?.milestones || [];
  
  const customerCollected = milestones.filter(m => m.customerStatus === 'Paid').reduce((sum, m) => sum + m.customerAmount, 0);
  const hqPaid = milestones.filter(m => m.hqStatus === 'Paid').reduce((sum, m) => sum + m.hqAmount, 0);
  
  const customerProgress = data?.totalRevenue ? Math.round((customerCollected / data.totalRevenue) * 100) : 0;
  const hqProgress = data?.totalCost ? Math.round((hqPaid / data.totalCost) * 100) : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-brand-secondary/30 overflow-hidden">
      {/* Header Section */}
      <div className="p-6 border-b border-brand-secondary/30 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-muted/15">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-muted/15 rounded-xl flex items-center justify-center text-brand-dark shrink-0 shadow-sm border border-brand-secondary/30">
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-brand-dark">{project.name}</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-brand-dark/80 mt-1">
              <span className="font-medium text-brand-dark/80">{project.customer}</span>
              <span>•</span>
              <span className="px-2 py-0.5 bg-white rounded border border-brand-secondary/30 font-mono text-xs shadow-sm">
                # {project.id}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-brand-dark/80">
            CURRENCY:
            <select className="px-3 py-1.5 bg-white border border-brand-secondary/50 rounded-lg text-brand-dark focus:outline-none shadow-sm">
              <option>USD ($)</option>
            </select>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button onClick={handleCancel} className="px-4 py-2 bg-white border border-brand-secondary/50 rounded-lg font-medium text-sm text-brand-dark hover:bg-brand-muted/15 shadow-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-brand-dark text-brand-light rounded-lg font-medium text-sm hover:bg-brand-dark/90 shadow-sm transition-colors">
                Save
              </button>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white border border-brand-secondary/50 rounded-lg font-medium text-sm text-brand-dark hover:bg-brand-muted/15 flex items-center gap-2 shadow-sm transition-colors">
              <Edit3 size={16} /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Revenue Card */}
          <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-6">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-4">
              <FileText size={16} /> REVENUE (CUSTOMER CONTRACT)
            </div>
            <div className="flex justify-between items-end mb-2">
              <div>
                <div className="text-emerald-700/70 text-xs font-medium mb-1">Total Contract Amount</div>
                {isEditing ? (
                  <input 
                    type="number" 
                    value={editData?.totalRevenue || 0} 
                    onChange={e => setEditData(prev => prev ? {...prev, totalRevenue: Number(e.target.value)} : null)}
                    className="text-2xl font-bold text-emerald-900 bg-white border-2 border-emerald-200 rounded-lg px-3 py-1 w-48 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all shadow-sm"
                  />
                ) : (
                  <div className="text-3xl font-bold text-emerald-900 font-mono">{data?.totalRevenue?.toLocaleString()}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-emerald-700/70 text-xs font-medium mb-1">Collected</div>
                <div className="text-xl font-bold text-emerald-700 font-mono">{customerCollected.toLocaleString()}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2.5 w-full bg-emerald-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${customerProgress}%` }}></div>
              </div>
              <div className="flex justify-between items-center mt-2 text-xs font-medium text-emerald-700">
                <span>0%</span>
                <span>{customerProgress}% Collected</span>
              </div>
            </div>
          </div>

          {/* Cost Card */}
          <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-6">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-sm mb-4">
              <FileText size={16} /> COST (HQ CONTRACT)
            </div>
            <div className="flex justify-between items-end mb-2">
              <div>
                <div className="text-blue-700/70 text-xs font-medium mb-1">Total Contract Amount</div>
                {isEditing ? (
                  <input 
                    type="number" 
                    value={editData?.totalCost || 0} 
                    onChange={e => setEditData(prev => prev ? {...prev, totalCost: Number(e.target.value)} : null)}
                    className="text-2xl font-bold text-blue-900 bg-white border-2 border-blue-200 rounded-lg px-3 py-1 w-48 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all shadow-sm"
                  />
                ) : (
                  <div className="text-3xl font-bold text-blue-900 font-mono">{data?.totalCost?.toLocaleString()}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-blue-700/70 text-xs font-medium mb-1">Paid</div>
                <div className="text-xl font-bold text-blue-700 font-mono">{hqPaid.toLocaleString()}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2.5 w-full bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${hqProgress}%` }}></div>
              </div>
              <div className="flex justify-between items-center mt-2 text-xs font-medium text-blue-700">
                <span>0%</span>
                <span>{hqProgress}% Paid</span>
              </div>
            </div>
          </div>
        </div>

        {/* Milestones Table */}
        <div>
          <div className="flex items-center gap-2 font-bold text-brand-dark mb-4">
            <CreditCard size={20} /> PAYMENT MILESTONES
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-brand-secondary/30 overflow-hidden">
            <div className="flex items-center gap-4 p-4 border-b border-brand-secondary/30 bg-brand-muted/15 text-xs font-bold text-brand-dark/80">
              <div className="w-[60px] text-center shrink-0">DONE</div>
              <div className="flex-1">MILESTONE</div>
              <div className="w-[60px] text-center shrink-0">ACTION</div>
            </div>
            
            <div className="divide-y divide-brand-dark/5">
              {milestones.map((m, idx) => (
                <div key={m.id} className="flex flex-col hover:bg-brand-dark/[0.02] transition-colors pb-6">
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex justify-center w-[60px] shrink-0">
                      <button 
                        onClick={() => isEditing ? updateMilestone(idx, 'isDone', !m.isDone) : quickUpdateStatus(idx, 'isDone', !m.isDone)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${m.isDone ? 'bg-emerald-50 border-emerald-500 text-emerald-500' : 'border-brand-secondary/50 text-transparent hover:border-brand-dark/40'}`}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                    </div>
                    
                    <div className="font-bold text-brand-dark flex-1 flex items-center gap-2">
                      <span className="text-brand-secondary">{idx + 1}.</span>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={m.name} 
                          onChange={e => updateMilestone(idx, 'name', e.target.value)}
                          className="w-full max-w-md px-3 py-1.5 bg-white border-2 border-brand-secondary/30 rounded-lg focus:outline-none focus:border-brand-dark/30 focus:ring-4 focus:ring-brand-dark/5 font-normal transition-all shadow-sm"
                        />
                      ) : (
                        <span className="text-lg">{m.name}</span>
                      )}
                    </div>
                    
                    <div className="flex justify-center w-[60px] shrink-0">
                      {isEditing ? (
                        <button onClick={() => removeMilestone(idx)} className="text-brand-dark/30 hover:text-red-500 transition-colors p-2">
                          <Trash2 size={18} />
                        </button>
                      ) : (
                        <div className="text-brand-dark/20 p-2">
                          <Trash2 size={18} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detailed Fields Row */}
                  <div className="px-4 pl-[76px] pr-4 md:pr-[76px]">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      
                      {/* Customer (AR) Details */}
                      <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-5">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-emerald-200/50">
                          <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                            <Building2 size={16} /> Customer (AR)
                          </h4>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-white/60 rounded-md px-3 py-1.5 border border-emerald-200">
                              <span className="text-xs text-emerald-700/50 font-bold mr-2">USD</span>
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={m.customerAmount} 
                                  onChange={e => updateMilestone(idx, 'customerAmount', Number(e.target.value))}
                                  className="w-24 bg-white border-2 border-emerald-200 rounded-md px-2 py-0.5 font-mono font-bold text-emerald-900 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all shadow-sm"
                                />
                              ) : (
                                <span className="font-mono font-bold text-emerald-900">{m.customerAmount.toLocaleString()}</span>
                              )}
                            </div>
                            <div className="relative min-w-[110px]">
                              <select 
                                value={m.customerStatus} 
                                onChange={e => isEditing ? updateMilestone(idx, 'customerStatus', e.target.value) : quickUpdateStatus(idx, 'customerStatus', e.target.value)}
                                className={`appearance-none w-full px-3 py-1.5 pr-8 rounded-md text-xs font-bold border focus:outline-none cursor-pointer ${
                                  m.customerStatus === 'Paid' ? 'bg-emerald-600 text-white border-emerald-700' : 
                                  'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50'
                                }`}
                              >
                                <option value="Paid">PAID</option>
                                <option value="Invoiced">INVOICED</option>
                                <option value="Pending">PENDING</option>
                              </select>
                              <ChevronDown size={14} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${m.customerStatus === 'Paid' ? 'text-white opacity-80' : 'text-emerald-900 opacity-50'}`} />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Invoice Number</label>
                            {isEditing ? (
                              <input type="text" value={m.customerInvoiceNumber || ''} onChange={e => updateMilestone(idx, 'customerInvoiceNumber', e.target.value)} className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-sm transition-all shadow-sm" placeholder="e.g. INV-001" />
                            ) : (
                              <div className="text-sm font-medium text-emerald-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.customerInvoiceNumber || '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Invoice Date</label>
                            {isEditing ? (
                              <input type="date" value={m.customerInvoiceDate || ''} onChange={e => updateMilestone(idx, 'customerInvoiceDate', e.target.value)} className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-sm transition-all shadow-sm" />
                            ) : (
                              <div className="text-sm font-medium text-emerald-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.customerInvoiceDate || '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Net Terms</label>
                            {isEditing ? (
                              <div className="relative">
                                <select value={m.customerNetTerms || ''} onChange={e => updateMilestone(idx, 'customerNetTerms', e.target.value)} className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-sm transition-all shadow-sm appearance-none cursor-pointer">
                                  <option value="">Select Terms</option>
                                  <option value="Net 30 days">Net 30 days</option>
                                  <option value="Net 45 days">Net 45 days</option>
                                  <option value="Net 60 days">Net 60 days</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-900/50" />
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-emerald-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.customerNetTerms || '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Due Date</label>
                            {isEditing ? (
                              <input type="date" value={m.customerDueDate || ''} onChange={e => updateMilestone(idx, 'customerDueDate', e.target.value)} className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-sm transition-all shadow-sm" />
                            ) : (
                              <div className="text-sm font-medium text-emerald-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.customerDueDate || '-'}</div>
                            )}
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Date Received</label>
                            {isEditing ? (
                              <input type="date" value={m.customerDateReceived || ''} onChange={e => updateMilestone(idx, 'customerDateReceived', e.target.value)} className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-sm transition-all shadow-sm" />
                            ) : (
                              <div className="text-sm font-medium text-emerald-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.customerDateReceived || '-'}</div>
                            )}
                          </div>
                          
                          {/* Tax & Retainage */}
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Retainage %</label>
                            {isEditing ? (
                              <div className="relative">
                                <input type="number" value={m.customerRetainagePercent || ''} onChange={e => updateMilestone(idx, 'customerRetainagePercent', Number(e.target.value))} className="w-full px-3 py-2 pr-8 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-sm transition-all shadow-sm" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-900/40 text-sm font-medium">%</span>
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-emerald-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.customerRetainagePercent ? `${m.customerRetainagePercent}%` : '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Retainage Amount</label>
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-900/40 text-sm font-medium">$</span>
                                <input type="number" value={m.customerRetainageAmount || ''} onChange={e => updateMilestone(idx, 'customerRetainageAmount', Number(e.target.value))} className="w-full px-3 py-2 pl-7 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-sm transition-all shadow-sm" />
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-emerald-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.customerRetainageAmount ? `$${m.customerRetainageAmount.toLocaleString()}` : '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Sales Tax %</label>
                            {isEditing ? (
                              <div className="relative">
                                <input type="number" value={m.customerSalesTaxPercent || ''} onChange={e => updateMilestone(idx, 'customerSalesTaxPercent', Number(e.target.value))} className="w-full px-3 py-2 pr-8 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-sm transition-all shadow-sm" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-900/40 text-sm font-medium">%</span>
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-emerald-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.customerSalesTaxPercent ? `${m.customerSalesTaxPercent}%` : '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Sales Tax Amount</label>
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-900/40 text-sm font-medium">$</span>
                                <input type="number" value={m.customerSalesTaxAmount || ''} onChange={e => updateMilestone(idx, 'customerSalesTaxAmount', Number(e.target.value))} className="w-full px-3 py-2 pl-7 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-sm transition-all shadow-sm" />
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-emerald-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.customerSalesTaxAmount ? `$${m.customerSalesTaxAmount.toLocaleString()}` : '-'}</div>
                            )}
                          </div>
                          <div className="col-span-2 mt-2">
                            <label className="block text-[10px] font-bold text-emerald-900/60 uppercase mb-1.5">Payment Amount</label>
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-900/40 text-sm font-medium">$</span>
                                <input type="number" value={m.customerPaymentAmount || ''} onChange={e => updateMilestone(idx, 'customerPaymentAmount', Number(e.target.value))} className="w-full px-3 py-2 pl-7 bg-emerald-100/50 border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold text-emerald-900 transition-all shadow-sm" />
                              </div>
                            ) : (
                              <div className="text-sm font-bold text-emerald-800 bg-emerald-100/50 px-3 py-2 rounded-lg border border-emerald-200">{m.customerPaymentAmount ? `$${m.customerPaymentAmount.toLocaleString()}` : '-'}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* HQ (AP) Details */}
                      <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-5">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-blue-200/50">
                          <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                            <Factory size={16} /> HQ (AP)
                          </h4>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-white/60 rounded-md px-3 py-1.5 border border-blue-200">
                              <span className="text-xs text-blue-700/50 font-bold mr-2">USD</span>
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={m.hqAmount} 
                                  onChange={e => updateMilestone(idx, 'hqAmount', Number(e.target.value))}
                                  className="w-24 bg-white border-2 border-blue-200 rounded-md px-2 py-0.5 font-mono font-bold text-blue-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all shadow-sm"
                                />
                              ) : (
                                <span className="font-mono font-bold text-blue-900">{m.hqAmount.toLocaleString()}</span>
                              )}
                            </div>
                            <div className="relative min-w-[120px]">
                              <select 
                                value={m.hqStatus} 
                                onChange={e => isEditing ? updateMilestone(idx, 'hqStatus', e.target.value) : quickUpdateStatus(idx, 'hqStatus', e.target.value)}
                                className={`appearance-none w-full px-3 py-1.5 pr-8 rounded-md text-xs font-bold border focus:outline-none cursor-pointer ${
                                  m.hqStatus === 'Paid' ? 'bg-blue-600 text-white border-blue-700' : 
                                  'bg-white text-blue-900 border-blue-200 hover:bg-blue-50'
                                }`}
                              >
                                <option value="Paid">PAID</option>
                                <option value="Pending">PENDING</option>
                                <option value="Not Started">NOT STARTED</option>
                              </select>
                              <ChevronDown size={14} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${m.hqStatus === 'Paid' ? 'text-white opacity-80' : 'text-blue-900 opacity-50'}`} />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Invoice Number</label>
                            {isEditing ? (
                              <input type="text" value={m.hqInvoiceNumber || ''} onChange={e => updateMilestone(idx, 'hqInvoiceNumber', e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 text-sm transition-all shadow-sm" placeholder="e.g. INV-001" />
                            ) : (
                              <div className="text-sm font-medium text-blue-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.hqInvoiceNumber || '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Invoice Date</label>
                            {isEditing ? (
                              <input type="date" value={m.hqInvoiceDate || ''} onChange={e => updateMilestone(idx, 'hqInvoiceDate', e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 text-sm transition-all shadow-sm" />
                            ) : (
                              <div className="text-sm font-medium text-blue-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.hqInvoiceDate || '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Net Terms</label>
                            {isEditing ? (
                              <div className="relative">
                                <select value={m.hqNetTerms || ''} onChange={e => updateMilestone(idx, 'hqNetTerms', e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 text-sm transition-all shadow-sm appearance-none cursor-pointer">
                                  <option value="">Select Terms</option>
                                  <option value="Net 30 days">Net 30 days</option>
                                  <option value="Net 45 days">Net 45 days</option>
                                  <option value="Net 60 days">Net 60 days</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-900/50" />
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-blue-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.hqNetTerms || '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Due Date</label>
                            {isEditing ? (
                              <input type="date" value={m.hqDueDate || ''} onChange={e => updateMilestone(idx, 'hqDueDate', e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 text-sm transition-all shadow-sm" />
                            ) : (
                              <div className="text-sm font-medium text-blue-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.hqDueDate || '-'}</div>
                            )}
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Date Paid</label>
                            {isEditing ? (
                              <input type="date" value={m.hqDatePaid || ''} onChange={e => updateMilestone(idx, 'hqDatePaid', e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 text-sm transition-all shadow-sm" />
                            ) : (
                              <div className="text-sm font-medium text-blue-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.hqDatePaid || '-'}</div>
                            )}
                          </div>
                          
                          {/* Tax & Retainage */}
                          <div>
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Retainage %</label>
                            {isEditing ? (
                              <div className="relative">
                                <input type="number" value={m.hqRetainagePercent || ''} onChange={e => updateMilestone(idx, 'hqRetainagePercent', Number(e.target.value))} className="w-full px-3 py-2 pr-8 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 text-sm transition-all shadow-sm" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900/40 text-sm font-medium">%</span>
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-blue-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.hqRetainagePercent ? `${m.hqRetainagePercent}%` : '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Retainage Amount</label>
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-900/40 text-sm font-medium">$</span>
                                <input type="number" value={m.hqRetainageAmount || ''} onChange={e => updateMilestone(idx, 'hqRetainageAmount', Number(e.target.value))} className="w-full px-3 py-2 pl-7 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 text-sm transition-all shadow-sm" />
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-blue-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.hqRetainageAmount ? `$${m.hqRetainageAmount.toLocaleString()}` : '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Sales Tax %</label>
                            {isEditing ? (
                              <div className="relative">
                                <input type="number" value={m.hqSalesTaxPercent || ''} onChange={e => updateMilestone(idx, 'hqSalesTaxPercent', Number(e.target.value))} className="w-full px-3 py-2 pr-8 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 text-sm transition-all shadow-sm" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900/40 text-sm font-medium">%</span>
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-blue-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.hqSalesTaxPercent ? `${m.hqSalesTaxPercent}%` : '-'}</div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Sales Tax Amount</label>
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-900/40 text-sm font-medium">$</span>
                                <input type="number" value={m.hqSalesTaxAmount || ''} onChange={e => updateMilestone(idx, 'hqSalesTaxAmount', Number(e.target.value))} className="w-full px-3 py-2 pl-7 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 text-sm transition-all shadow-sm" />
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-blue-900 bg-white/50 px-3 py-2 rounded-lg border border-transparent">{m.hqSalesTaxAmount ? `$${m.hqSalesTaxAmount.toLocaleString()}` : '-'}</div>
                            )}
                          </div>
                          <div className="col-span-2 mt-2">
                            <label className="block text-[10px] font-bold text-blue-900/60 uppercase mb-1.5">Payment Amount</label>
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-900/40 text-sm font-medium">$</span>
                                <input type="number" value={m.hqPaymentAmount || ''} onChange={e => updateMilestone(idx, 'hqPaymentAmount', Number(e.target.value))} className="w-full px-3 py-2 pl-7 bg-blue-100/50 border border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-blue-900 transition-all shadow-sm" />
                              </div>
                            ) : (
                              <div className="text-sm font-bold text-blue-800 bg-blue-100/50 px-3 py-2 rounded-lg border border-blue-200">{m.hqPaymentAmount ? `$${m.hqPaymentAmount.toLocaleString()}` : '-'}</div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {isEditing && (
              <div className="p-4 border-t border-brand-secondary/30">
                <button 
                  onClick={addMilestone}
                  className="w-full py-3 border-2 border-dashed border-brand-secondary/50 rounded-lg text-brand-secondary font-medium hover:border-brand-dark/40 hover:text-brand-dark transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add New Milestone
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsView({ projects, onUpdateProject }: { projects: Project[], onUpdateProject: (p: Project) => void, key?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full mx-auto flex flex-col gap-6 pb-12"
    >
      <div className="flex flex-col gap-8">
        {projects.length > 0 ? (
          projects.map(project => (
            <ProjectPaymentCard 
              key={project.id} 
              project={project} 
              onUpdateProject={onUpdateProject} 
            />
          ))
        ) : (
          <div className="flex items-center justify-center bg-white rounded-xl border border-brand-secondary/30 min-h-[400px]">
            <p className="text-brand-secondary">No projects found.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CarrierGroup({ carrier, projs, expandedId, setExpandedId, onUpdateProject }: { carrier: string, projs: Project[], expandedId: string | null, setExpandedId: (id: string | null) => void, onUpdateProject: (p: Project) => void, key?: string }) {
  const [isGroupExpanded, setIsGroupExpanded] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <h3 
        className="text-lg font-bold text-brand-dark border-b border-brand-secondary/30 pb-2 flex items-center gap-2 cursor-pointer hover:text-brand-dark/80 transition-colors select-none"
        onClick={() => setIsGroupExpanded(!isGroupExpanded)}
      >
        <Truck size={18} className="text-brand-secondary" />
        {carrier}
        <span className="text-sm font-normal text-brand-secondary bg-brand-muted/15 px-2 py-0.5 rounded-full ml-2">{projs.length}</span>
        <ChevronDown size={18} className={`ml-auto text-brand-secondary transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`} />
      </h3>
      <AnimatePresence>
        {isGroupExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-3 overflow-hidden"
          >
            {projs.map(p => (
              <TransportationCard 
                key={p.id} 
                project={p} 
                isExpanded={expandedId === p.id} 
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} 
                onUpdate={onUpdateProject} 
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TransportationView({ projects, onUpdateProject }: { projects: Project[], onUpdateProject: (p: Project) => void, key?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const groupedProjects = projects.reduce((acc, p) => {
    const carrier = p.inlandTransport.carrier || 'Unassigned / TBD';
    if (!acc[carrier]) acc[carrier] = [];
    acc[carrier].push(p);
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full mx-auto flex flex-col gap-6 pb-12"
    >
      <h2 className="text-2xl font-bold mb-2 text-brand-dark flex items-center gap-2">
        <Truck className="text-brand-secondary" />
        Transportation Overview
      </h2>
      
      {projects.length === 0 ? (
        <div className="p-8 text-center text-brand-secondary bg-white rounded-xl border border-brand-secondary/30">No projects found.</div>
      ) : (
        Object.entries(groupedProjects).map(([carrier, projs]) => (
          <CarrierGroup 
            key={carrier} 
            carrier={carrier} 
            projs={projs} 
            expandedId={expandedId} 
            setExpandedId={setExpandedId} 
            onUpdateProject={onUpdateProject} 
          />
        ))
      )}
    </motion.div>
  );
}



function TransportationCard({ project, isExpanded, onToggle, onUpdate }: { project: Project, isExpanded: boolean, onToggle: () => void, onUpdate: (p: Project) => void, key?: string }) {
  const handleChange = (field: string, value: any, nestedObj?: 'oceanFreight' | 'inlandTransport' | 'installation') => {
    const updated = { ...project };
    if (nestedObj) {
      (updated as any)[nestedObj] = { ...(updated as any)[nestedObj], [field]: value };
    } else {
      (updated as any)[field] = value;
    }
    onUpdate(updated);
  };

  const handleDocChange = (docName: string, received: boolean, date?: string) => {
    const updated = { ...project };
    const docs = [...updated.oceanFreight.documents];
    const existingIdx = docs.findIndex(d => d.name === docName || (docName === 'SBL' && d.name === 'B/L'));
    if (existingIdx >= 0) {
      docs[existingIdx] = { ...docs[existingIdx], received, date: date !== undefined ? date : docs[existingIdx].date };
    } else {
      docs.push({ name: docName, received, date });
    }
    updated.oceanFreight.documents = docs;
    onUpdate(updated);
  };

  const getDoc = (docName: string) => {
    return project.oceanFreight.documents.find(d => d.name === docName || (docName === 'SBL' && d.name === 'B/L'))?.received || false;
  };

  const getDocDate = (docName: string) => {
    return project.oceanFreight.documents.find(d => d.name === docName || (docName === 'SBL' && d.name === 'B/L'))?.date || '';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-brand-secondary/30 overflow-hidden transition-all">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-brand-muted/15"
        onClick={onToggle}
      >
        <div className="flex-1 grid grid-cols-9 gap-4 items-center mr-4 py-2">
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">SO#</span>
            <span className="text-sm font-bold text-brand-dark truncate">{project.id}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Project</span>
            <span className="text-sm font-medium text-brand-dark truncate" title={project.name}>{project.name}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Customer</span>
            <span className="text-sm text-brand-dark truncate" title={project.customer}>{project.customer}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Carrier</span>
            <span className="text-sm text-brand-dark truncate" title={project.inlandTransport.carrier || '-'}>{project.inlandTransport.carrier || '-'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Serial #</span>
            <span className="text-sm text-brand-dark truncate" title={project.serialNumber || '-'}>{project.serialNumber || '-'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Departure</span>
            <span className="text-sm text-brand-dark truncate">
              {(project.oceanFreight.atd && project.oceanFreight.atd !== '-') ? (
                <span className="text-emerald-600 font-medium">{project.oceanFreight.atd} (A)</span>
              ) : (
                <span>{project.oceanFreight.etd || '-'} (E)</span>
              )}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Arrival</span>
            <span className="text-sm text-brand-dark truncate">
              {(project.oceanFreight.ata && project.oceanFreight.ata !== '-') ? (
                <span className="text-emerald-600 font-medium">{project.oceanFreight.ata} (A)</span>
              ) : (
                <span>{project.oceanFreight.eta || '-'} (E)</span>
              )}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">CIF Date</span>
            <span className="text-sm text-brand-dark font-medium truncate">{project.oceanFreight.cifDate || '-'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">DDP Date</span>
            <span className="text-sm text-brand-dark font-medium truncate">{project.inlandTransport.ddpDate || '-'}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 bg-brand-dark/10 rounded-full text-xs font-bold text-brand-dark">
            {project.currentStage}
          </span>
          <ChevronDown className={`text-brand-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-brand-secondary/30 bg-brand-light/20 overflow-hidden"
          >
            <div className="p-6 flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                {/* General Info */}
              <div className="space-y-4">
                <h4 className="font-bold text-brand-dark border-b border-brand-secondary/30 pb-2">General Info</h4>
                <Field label="Unit Type" value={project.unitType || ''} onChange={(v) => handleChange('unitType', v as any)} />
                <Field label="Serial #" value={project.serialNumber || ''} onChange={(v) => handleChange('serialNumber', v)} />
                <Field label="Customer" value={project.customer || ''} onChange={(v) => handleChange('customer', v)} />
                <Field label="Project" value={project.name || ''} onChange={(v) => handleChange('name', v)} />
                <Field label="KV" value={project.kv || ''} onChange={(v) => handleChange('kv', v)} />
                <Field label="MVA" value={project.mva || ''} onChange={(v) => handleChange('mva', v)} />
                <TextAreaField label="Site Contact" value={project.inlandTransport.siteContact || ''} onChange={(v) => handleChange('siteContact', v, 'inlandTransport')} />
              </div>

              {/* Ocean Transportation */}
              <div className="space-y-4">
                <h4 className="font-bold text-brand-dark border-b border-brand-secondary/30 pb-2">Ocean Transportation</h4>
                <CheckboxWithDateField label="1. CIPL" checked={getDoc('CIPL')} date={getDocDate('CIPL')} onCheckChange={(v) => handleDocChange('CIPL', v)} onDateChange={(v) => handleDocChange('CIPL', getDoc('CIPL'), v)} />
                <CheckboxWithDateField label="2. ISF Filling" checked={getDoc('ISF')} date={getDocDate('ISF')} onCheckChange={(v) => handleDocChange('ISF', v)} onDateChange={(v) => handleDocChange('ISF', getDoc('ISF'), v)} />
                <CheckboxWithDateField label="3. SBL" checked={getDoc('SBL')} date={getDocDate('SBL')} onCheckChange={(v) => handleDocChange('SBL', v)} onDateChange={(v) => handleDocChange('SBL', getDoc('SBL'), v)} />
                <CheckboxWithDateField label="4. Inventory" checked={getDoc('Inventory')} date={getDocDate('Inventory')} onCheckChange={(v) => handleDocChange('Inventory', v)} onDateChange={(v) => handleDocChange('Inventory', getDoc('Inventory'), v)} />
                <CheckboxWithDateField label="5. AN" checked={getDoc('Arrival Notice')} date={getDocDate('Arrival Notice')} onCheckChange={(v) => handleDocChange('Arrival Notice', v)} onDateChange={(v) => handleDocChange('Arrival Notice', getDoc('Arrival Notice'), v)} />
                <CheckboxWithDateField label="6. Customs Clearance" checked={getDoc('Customs Clearance')} date={getDocDate('Customs Clearance')} onCheckChange={(v) => handleDocChange('Customs Clearance', v)} onDateChange={(v) => handleDocChange('Customs Clearance', getDoc('Customs Clearance'), v)} />
                
                <div className="pt-6 mt-2 border-t border-brand-secondary/30">
                  <h5 className="text-xs font-bold text-brand-secondary uppercase tracking-wider mb-2">Document Sharing (Vendor)</h5>
                  <CheckboxWithDateField label="Packing List" checked={getDoc('Vendor - Packing List')} date={getDocDate('Vendor - Packing List')} onCheckChange={(v) => handleDocChange('Vendor - Packing List', v)} onDateChange={(v) => handleDocChange('Vendor - Packing List', getDoc('Vendor - Packing List'), v)} />
                  <CheckboxWithDateField label="SBL" checked={getDoc('Vendor - SBL')} date={getDocDate('Vendor - SBL')} onCheckChange={(v) => handleDocChange('Vendor - SBL', v)} onDateChange={(v) => handleDocChange('Vendor - SBL', getDoc('Vendor - SBL'), v)} />
                  <CheckboxWithDateField label="AN" checked={getDoc('Vendor - AN')} date={getDocDate('Vendor - AN')} onCheckChange={(v) => handleDocChange('Vendor - AN', v)} onDateChange={(v) => handleDocChange('Vendor - AN', getDoc('Vendor - AN'), v)} />
                </div>

              </div>

              {/* Inland Transportation */}
              <div className="space-y-4">
                <h4 className="font-bold text-brand-dark border-b border-brand-secondary/30 pb-2">Inland Transportation</h4>
                <CheckboxWithDateField label="1. Rail Clearance" checked={getDoc('Rail Clearance')} date={getDocDate('Rail Clearance')} onCheckChange={(v) => handleDocChange('Rail Clearance', v)} onDateChange={(v) => handleDocChange('Rail Clearance', getDoc('Rail Clearance'), v)} />
                <CheckboxWithDateField label="2. Route Survey" checked={getDoc('Route Survey')} date={getDocDate('Route Survey')} onCheckChange={(v) => handleDocChange('Route Survey', v)} onDateChange={(v) => handleDocChange('Route Survey', getDoc('Route Survey'), v)} />
                <CheckboxWithDateField label="3. HH Permit" checked={getDoc('HH Permit status')} date={getDocDate('HH Permit status')} onCheckChange={(v) => handleDocChange('HH Permit status', v)} onDateChange={(v) => handleDocChange('HH Permit status', getDoc('HH Permit status'), v)} />
                <CheckboxWithDateField label="4. Site Visit" checked={getDoc('Site visit report')} date={getDocDate('Site visit report')} onCheckChange={(v) => handleDocChange('Site visit report', v)} onDateChange={(v) => handleDocChange('Site visit report', getDoc('Site visit report'), v)} />
                <CheckboxWithDateField label="5. Loading Drawing" checked={getDoc('Loading Drawing')} date={getDocDate('Loading Drawing')} onCheckChange={(v) => handleDocChange('Loading Drawing', v)} onDateChange={(v) => handleDocChange('Loading Drawing', getDoc('Loading Drawing'), v)} />
                <CheckboxWithDateField label="6. Transportation Plan" checked={getDoc('Transportation Plan')} date={getDocDate('Transportation Plan')} onCheckChange={(v) => handleDocChange('Transportation Plan', v)} onDateChange={(v) => handleDocChange('Transportation Plan', getDoc('Transportation Plan'), v)} />
                
                <div className="pt-6 mt-2 border-t border-brand-secondary/30">
                  <h5 className="text-xs font-bold text-brand-secondary uppercase tracking-wider mb-2">Document Sharing (Broker)</h5>
                  <CheckboxWithDateField label="CIPL" checked={getDoc('Broker - CIPL')} date={getDocDate('Broker - CIPL')} onCheckChange={(v) => handleDocChange('Broker - CIPL', v)} onDateChange={(v) => handleDocChange('Broker - CIPL', getDoc('Broker - CIPL'), v)} />
                  <CheckboxWithDateField label="SBL" checked={getDoc('Broker - SBL')} date={getDocDate('Broker - SBL')} onCheckChange={(v) => handleDocChange('Broker - SBL', v)} onDateChange={(v) => handleDocChange('Broker - SBL', getDoc('Broker - SBL'), v)} />
                  <CheckboxWithDateField label="AN" checked={getDoc('Broker - AN')} date={getDocDate('Broker - AN')} onCheckChange={(v) => handleDocChange('Broker - AN', v)} onDateChange={(v) => handleDocChange('Broker - AN', getDoc('Broker - AN'), v)} />
                  <CheckboxWithDateField label="COO" checked={getDoc('Broker - COO')} date={getDocDate('Broker - COO')} onCheckChange={(v) => handleDocChange('Broker - COO', v)} onDateChange={(v) => handleDocChange('Broker - COO', getDoc('Broker - COO'), v)} />
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-4">
                <h4 className="font-bold text-brand-dark border-b border-brand-secondary/30 pb-2">Dates</h4>
                <DateField label="Departure from Korea" value={project.oceanFreight.etd || ''} onChange={(v) => handleChange('etd', v, 'oceanFreight')} />
                <DateField label="Arrival at US Port" value={project.oceanFreight.eta || ''} onChange={(v) => handleChange('eta', v, 'oceanFreight')} />
                <DateField label="CIF Date" value={project.oceanFreight.cifDate || ''} onChange={(v) => handleChange('cifDate', v, 'oceanFreight')} />
                <DateField label="Actual Ship out (KR)" value={project.oceanFreight.atd || ''} onChange={(v) => handleChange('atd', v, 'oceanFreight')} />
                <DateField label="Actual Arrival (US)" value={project.oceanFreight.ata || ''} onChange={(v) => handleChange('ata', v, 'oceanFreight')} />
                <DateField label="DDP date" value={project.inlandTransport.ddpDate || ''} onChange={(v) => handleChange('ddpDate', v, 'inlandTransport')} />
              </div>

              {/* Logistics Details */}
              <div className="space-y-4">
                <h4 className="font-bold text-brand-dark border-b border-brand-secondary/30 pb-2">Logistics Details</h4>
                <Field label="Transit time" value={project.inlandTransport.transitTime || ''} onChange={(v) => handleChange('transitTime', v, 'inlandTransport')} />
                <Field label="Port" value={project.inlandTransport.port || project.origin || ''} onChange={(v) => handleChange('port', v, 'inlandTransport')} />
                <Field label="Site Address" value={project.destination || ''} onChange={(v) => handleChange('destination', v)} />
                <SelectField label="Method" value={project.inlandTransport.dischargingMethod || ''} options={['Rail', 'Trailer', 'Barge']} onChange={(v) => handleChange('dischargingMethod', v, 'inlandTransport')} />
                <Field label="Railcar #" value={project.inlandTransport.railcarNumber || ''} onChange={(v) => handleChange('railcarNumber', v, 'inlandTransport')} />
                <Field label="HH Vendor" value={project.inlandTransport.hhVendor || ''} onChange={(v) => handleChange('hhVendor', v, 'inlandTransport')} />
                <Field label="Rigging Vendor" value={project.inlandTransport.riggingVendor || project.installation.contractor || ''} onChange={(v) => handleChange('riggingVendor', v, 'inlandTransport')} />
              </div>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string, value: string, options: string[], onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-brand-dark/80">{label}</label>
      <div className="relative">
        <select 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-1.5 bg-white border border-brand-secondary/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 transition-shadow appearance-none"
        >
          <option value="" disabled>Select {label}</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-secondary pointer-events-none" />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string, value: string, onChange: (v: string) => void, type?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-brand-dark/80">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 bg-white border border-brand-secondary/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 transition-shadow"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-brand-dark/80">{label}</label>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-1.5 bg-white border border-brand-secondary/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 transition-shadow min-h-[60px] resize-y"
      />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return <Field label={label} value={value} onChange={onChange} type="date" />;
}

function CheckboxWithDateField({ label, checked, date, onCheckChange, onDateChange }: { label: string, checked: boolean, date: string, onCheckChange: (v: boolean) => void, onDateChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between group gap-4">
      <label className="flex items-center gap-3 cursor-pointer flex-1">
        <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-emerald-500' : 'bg-brand-dark/20'}`}>
          <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onCheckChange(e.target.checked)} />
          <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
        <span className="text-sm font-medium text-brand-dark/80 group-hover:text-brand-dark truncate">{label}</span>
      </label>
      <input 
        type="date" 
        value={date} 
        onChange={(e) => onDateChange(e.target.value)}
        className="px-2 py-1 bg-white border border-brand-secondary/50 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-dark/30 w-32"
      />
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm font-medium text-brand-dark/80 group-hover:text-brand-dark">{label}</span>
      <div className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-emerald-500' : 'bg-brand-dark/20'}`}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </label>
  );
}

function ContractorGroup({ contractor, projs, expandedId, setExpandedId, onUpdateProject }: { contractor: string, projs: Project[], expandedId: string | null, setExpandedId: (id: string | null) => void, onUpdateProject: (p: Project) => void, key?: string }) {
  const [isGroupExpanded, setIsGroupExpanded] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <h3 
        className="text-lg font-bold text-brand-dark border-b border-brand-secondary/30 pb-2 flex items-center gap-2 cursor-pointer hover:text-brand-dark/80 transition-colors select-none"
        onClick={() => setIsGroupExpanded(!isGroupExpanded)}
      >
        <Wrench size={18} className="text-brand-secondary" />
        {contractor}
        <span className="text-sm font-normal text-brand-secondary bg-brand-muted/15 px-2 py-0.5 rounded-full ml-2">{projs.length}</span>
        <ChevronDown size={18} className={`ml-auto text-brand-secondary transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`} />
      </h3>
      <AnimatePresence>
        {isGroupExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-3 overflow-hidden"
          >
            {projs.map(p => (
              <InstallationCard 
                key={p.id} 
                project={p} 
                isExpanded={expandedId === p.id} 
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} 
                onUpdate={onUpdateProject} 
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InstallationCard({ project, isExpanded, onToggle, onUpdate }: { project: Project, isExpanded: boolean, onToggle: () => void, onUpdate: (p: Project) => void, key?: string }) {
  const handleChange = (field: string, value: any, nestedObj?: 'oceanFreight' | 'inlandTransport' | 'installation') => {
    const updated = { ...project };
    if (nestedObj) {
      (updated as any)[nestedObj] = { ...(updated as any)[nestedObj], [field]: value };
    } else {
      (updated as any)[field] = value;
    }
    onUpdate(updated);
  };

  const oilDeliveries = [...(project.installation.oilDeliveries || [])];
  while (oilDeliveries.length < 4) {
    oilDeliveries.push({ name: '', date: '', time: '' });
  }

  const handleOilChange = (index: number, field: string, value: string) => {
    const newDeliveries = [...oilDeliveries];
    newDeliveries[index] = { ...newDeliveries[index], [field]: value };
    handleChange('oilDeliveries', newDeliveries, 'installation');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-brand-secondary/30 overflow-hidden transition-all">
      <div onClick={onToggle} className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-brand-muted/15 transition-colors">
        <div className="flex-1 grid grid-cols-7 gap-4 items-center mr-4 py-2">
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">SO#</span>
            <span className="text-sm font-bold text-brand-dark truncate">{project.id}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Project</span>
            <span className="text-sm font-medium text-brand-dark truncate" title={project.name}>{project.name}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Customer</span>
            <span className="text-sm text-brand-dark truncate" title={project.customer}>{project.customer}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Contractor</span>
            <span className="text-sm text-brand-dark truncate" title={project.installation.contractor || '-'}>{project.installation.contractor || '-'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Serial #</span>
            <span className="text-sm text-brand-dark truncate" title={project.serialNumber || '-'}>{project.serialNumber || '-'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">Start Date</span>
            <span className="text-sm text-brand-dark font-medium truncate">{project.installation.startDate || '-'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider">End Date</span>
            <span className="text-sm text-brand-dark font-medium truncate">{project.installation.endDate || '-'}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 bg-brand-dark/10 rounded-full text-xs font-bold text-brand-dark">
            {project.currentStage}
          </span>
          <ChevronDown className={`text-brand-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-brand-secondary/30 bg-brand-light/20 overflow-hidden"
          >
            <div className="p-6 flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Field label="Customer" value={project.customer || ''} onChange={(v) => handleChange('customer', v)} />
                <Field label="Project" value={project.name || ''} onChange={(v) => handleChange('name', v)} />
                <Field label="KV" value={project.kv || ''} onChange={(v) => handleChange('kv', v)} />
                <Field label="MVA" value={project.mva || ''} onChange={(v) => handleChange('mva', v)} />
                <Field label="Serial #" value={project.serialNumber || ''} onChange={(v) => handleChange('serialNumber', v)} />
                <DateField label="Delivery Date (DDP)" value={project.inlandTransport.ddpDate || ''} onChange={(v) => handleChange('ddpDate', v, 'inlandTransport')} />
                <DateField label="Inst. Start Date" value={project.installation.startDate || ''} onChange={(v) => handleChange('startDate', v, 'installation')} />
                <DateField label="Inst. End Date" value={project.installation.endDate || ''} onChange={(v) => handleChange('endDate', v, 'installation')} />
                <Field label="Contractor" value={project.installation.contractor || ''} onChange={(v) => handleChange('contractor', v, 'installation')} />
                <Field label="Supervisor" value={project.installation.supervisor || ''} onChange={(v) => handleChange('supervisor', v, 'installation')} />
                <Field label="Site Address" value={project.destination || ''} onChange={(v) => handleChange('destination', v)} />
              </div>
              
              <TextAreaField label="Site Contact" value={project.inlandTransport.siteContact || ''} onChange={(v) => handleChange('siteContact', v, 'inlandTransport')} />

              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold text-brand-dark border-b border-brand-secondary/30 pb-2">Oil Delivery Schedule</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-white p-3 rounded-lg border border-brand-secondary/30 shadow-sm">
                      <span className="text-sm font-bold text-brand-dark/80 w-24 shrink-0">{getDeliveryLabel(i)}</span>
                      <div className="flex-1 sm:w-32"><DateField label="Date" value={oilDeliveries[i].date} onChange={(v) => handleOilChange(i, 'date', v)} /></div>
                      <div className="flex-1 sm:w-24"><Field label="Time" type="time" value={oilDeliveries[i].time} onChange={(v) => handleOilChange(i, 'time', v)} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InstallationView({ projects, onUpdateProject }: { projects: Project[], onUpdateProject: (p: Project) => void, key?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const groupedProjects = projects.reduce((acc, p) => {
    const contractor = p.installation.contractor || 'Unassigned / TBD';
    if (!acc[contractor]) acc[contractor] = [];
    acc[contractor].push(p);
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full mx-auto flex flex-col gap-6 pb-12"
    >
      <h2 className="text-2xl font-bold mb-2 text-brand-dark flex items-center gap-2">
        <Wrench className="text-brand-secondary" />
        Installation Overview
      </h2>
      
      {projects.length === 0 ? (
        <div className="p-8 text-center text-brand-secondary bg-white rounded-xl border border-brand-secondary/30">No projects found.</div>
      ) : (
        Object.entries(groupedProjects).map(([contractor, projs]) => (
          <ContractorGroup 
            key={contractor} 
            contractor={contractor} 
            projs={projs} 
            expandedId={expandedId} 
            setExpandedId={setExpandedId} 
            onUpdateProject={onUpdateProject} 
          />
        ))
      )}
    </motion.div>
  );
}