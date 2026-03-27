/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  getDocFromServer,
  doc
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { LogIn, LogOut, Users, UserPlus, Building2, Mail, Phone, User as UserIcon, AlertCircle, Lock, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Error handling helper
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt: Timestamp;
  userId: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Auth form state
  const [isSignUp, setIsSignUp] = useState(false);
  const [authData, setAuthData] = useState({
    email: '',
    password: ''
  });
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  });

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Connection test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setError("Erro de conexão com Firebase. Verifique sua configuração.");
        }
      }
    }
    testConnection();
  }, []);

  // Fetch clients
  useEffect(() => {
    if (!user) {
      setClients([]);
      return;
    }

    const q = query(
      collection(db, 'clients'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clients');
      setError("Erro ao carregar clientes. Verifique as permissões.");
    });

    return unsubscribe;
  }, [user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, authData.email, authData.password);
      } else {
        await signInWithEmailAndPassword(auth, authData.email, authData.password);
      }
    } catch (err: any) {
      console.error("Auth error", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("E-mail ou senha incorretos.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está em uso.");
      } else if (err.code === 'auth/weak-password') {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("O login com E-mail/Senha não está ativado no Firebase Console.");
      } else {
        setError("Ocorreu um erro na autenticação. Tente novamente.");
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google login error", err);
      setError("Erro ao entrar com Google. Tente novamente.");
    }
  };

  const handleAnonymousLogin = async () => {
    setError(null);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error("Anonymous login error", err);
      setError("Erro ao entrar como convidado. Tente novamente.");
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !user) return;

    try {
      await addDoc(collection(db, 'clients'), {
        ...formData,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      setFormData({ name: '', email: '', phone: '', company: '' });
      setActiveTab('list');
      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'clients');
      setError("Erro ao cadastrar cliente. Verifique as regras de segurança.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <div className="relative">
          <div className="absolute inset-0 blur-xl bg-brand-400/30 animate-pulse rounded-full"></div>
          <div className="relative animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 glass-card p-6 rounded-[2.5rem]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-600 text-white rounded-2xl shadow-glow">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestão de Clientes</h1>
              <p className="text-slate-500 text-sm font-medium">Controle total dos seus contatos</p>
            </div>
          </div>
          {user ? (
            <div className="flex items-center gap-4 bg-slate-100/50 p-2 pr-4 rounded-full border border-slate-200/50">
              <div className="w-10 h-10 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold border border-brand-200">
                {user.email?.[0].toUpperCase() || 'C'}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 leading-none">
                  {user.isAnonymous ? 'Convidado' : user.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Online</span>
              </div>
              <button 
                onClick={handleLogout}
                className="ml-2 p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="text-sm font-semibold text-brand-600 bg-brand-100 px-4 py-2 rounded-full border border-brand-200">
              {isSignUp ? 'Criando nova conta' : 'Acesse sua conta'}
            </div>
          )}
        </header>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-red-50/80 backdrop-blur-md border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-sm shadow-sm"
          >
            <div className="p-2 bg-red-100 rounded-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            </div>
            <span className="font-medium">{error}</span>
          </motion.div>
        )}

        {user ? (
          <div className="space-y-8">
            <div className="flex gap-2 p-1.5 bg-slate-200/50 backdrop-blur-md rounded-2xl w-fit mx-auto border border-slate-300/30">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'list' ? 'bg-white shadow-deep text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Lista de Clientes
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'create' ? 'bg-white shadow-deep text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Novo Cadastro
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'create' ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onSubmit={handleAddClient}
                  className="glass-card p-10 rounded-[3rem] space-y-8 max-w-2xl mx-auto"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-slate-800">Novo Cliente</h2>
                    <p className="text-slate-500 text-sm">Preencha os dados abaixo para cadastrar</p>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <UserIcon className="w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Nome Completo"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 rounded-2xl glass-input outline-none"
                      />
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="E-mail de Contato"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 rounded-2xl glass-input outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Phone className="w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        </div>
                        <input
                          type="tel"
                          placeholder="Telefone"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          className="w-full pl-12 pr-6 py-4 rounded-2xl glass-input outline-none"
                        />
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Building2 className="w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          placeholder="Empresa / Organização"
                          value={formData.company}
                          onChange={e => setFormData({...formData, company: e.target.value})}
                          className="w-full pl-12 pr-6 py-4 rounded-2xl glass-input outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-5 bg-brand-600 text-white rounded-2xl font-bold shadow-glow hover:bg-brand-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    <UserPlus className="w-6 h-6" />
                    Finalizar Cadastro
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  <AnimatePresence mode="popLayout">
                    {clients.map((client) => (
                      <motion.div
                        key={client.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="glass-card p-8 rounded-[2rem] hover:shadow-deep hover:-translate-y-1 transition-all duration-300 group"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center font-bold text-xl group-hover:bg-brand-600 group-hover:text-white transition-colors">
                              {client.name[0]}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-slate-900 leading-tight">{client.name}</h3>
                              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
                                <Building2 className="w-3 h-3" />
                                {client.company || 'Pessoa Física'}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-3 text-slate-600 text-sm">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              <Mail className="w-4 h-4 text-brand-500" />
                            </div>
                            <span className="font-medium truncate">{client.email}</span>
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-3 text-slate-600 text-sm">
                              <div className="p-2 bg-slate-100 rounded-lg">
                                <Phone className="w-4 h-4 text-brand-500" />
                              </div>
                              <span className="font-medium">{client.phone}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                            Cadastrado em {client.createdAt?.toDate().toLocaleDateString()}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {clients.length === 0 && (
                    <div className="col-span-full text-center py-32 glass-card rounded-[3rem] border-dashed border-slate-300">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Users className="w-10 h-10 text-slate-300" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-400">Nenhum cliente encontrado</h3>
                      <p className="text-slate-400 text-sm mt-2">Comece cadastrando seu primeiro cliente!</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto glass-card p-10 rounded-[3rem] shadow-deep"
          >
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-brand-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-glow rotate-3">
                <Users className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900">
                {isSignUp ? 'Criar Conta' : 'Acesso Restrito'}
              </h2>
              <p className="text-slate-500 text-sm mt-3 font-medium">
                {isSignUp ? 'Junte-se a nós e organize seus clientes com facilidade.' : 'Entre com suas credenciais para gerenciar seus contatos.'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                <input
                  type="email"
                  required
                  placeholder="Seu e-mail"
                  value={authData.email}
                  onChange={e => setAuthData({...authData, email: e.target.value})}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl glass-input outline-none"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                <input
                  type="password"
                  required
                  placeholder="Sua senha"
                  value={authData.password}
                  onChange={e => setAuthData({...authData, password: e.target.value})}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl glass-input outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-5 bg-brand-600 text-white rounded-2xl font-bold shadow-glow hover:bg-brand-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                {isSignUp ? <UserPlus className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
                {isSignUp ? 'Criar Conta Agora' : 'Entrar no Sistema'}
              </button>
            </form>

            <div className="relative my-10">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-[0.2em]">
                <span className="bg-white px-4 text-slate-400">Ou continue com</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleGoogleLogin}
                className="flex items-center justify-center gap-3 py-4 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-brand-200 transition-all text-sm font-bold text-slate-700"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                  />
                </svg>
                Google
              </button>
              <button
                onClick={handleAnonymousLogin}
                className="flex items-center justify-center gap-3 py-4 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-brand-200 transition-all text-sm font-bold text-slate-700"
              >
                <UserIcon className="w-5 h-5 text-slate-400" />
                Convidado
              </button>
            </div>

            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full mt-8 text-sm font-bold text-brand-600 hover:text-brand-700 transition-colors flex items-center justify-center gap-2 group"
            >
              {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Cadastre-se'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
