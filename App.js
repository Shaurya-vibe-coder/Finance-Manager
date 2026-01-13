import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    StyleSheet,
    Modal,
    SafeAreaView,
    StatusBar,
    Alert,
    Dimensions,
    TouchableWithoutFeedback,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Share,
    Linking,
    BackHandler,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { auth, db } from './firebaseConfig';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    updateDoc
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authMode, setAuthMode] = useState('login');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    if (!user) {
        return <AuthScreen authMode={authMode} setAuthMode={setAuthMode} />;
    }

    return <MainApp user={user} />;
}

function AuthScreen({ authMode, setAuthMode }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (authMode === 'signup' && password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            if (authMode === 'signup') {
                await createUserWithEmailAndPassword(auth, email, password);
                Alert.alert('Success', 'Account created successfully!');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            let errorMessage = 'An error occurred';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Email already in use';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address';
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = 'User not found';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Wrong password';
            }
            Alert.alert('Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.authContainer}>
            <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.authContent}
            >
                <ScrollView contentContainerStyle={styles.authScrollContent}>
                    <View style={styles.authHeader}>
                        <Feather name="dollar-sign" size={60} color="#3B82F6" />
                        <Text style={styles.authTitle}>Finance Manager</Text>
                        <Text style={styles.authSubtitle}>
                            {authMode === 'login' ? 'Welcome back!' : 'Create your account'}
                        </Text>
                    </View>

                    <View style={styles.authForm}>
                        <View style={styles.authInputGroup}>
                            <Text style={styles.authLabel}>Email</Text>
                            <TextInput
                                style={styles.authInput}
                                placeholder="your@email.com"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.authInputGroup}>
                            <Text style={styles.authLabel}>Password</Text>
                            <TextInput
                                style={styles.authInput}
                                placeholder="Enter password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                            />
                        </View>

                        {authMode === 'signup' && (
                            <View style={styles.authInputGroup}>
                                <Text style={styles.authLabel}>Confirm Password</Text>
                                <TextInput
                                    style={styles.authInput}
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={handleAuth}
                            style={styles.authButton}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.authButtonText}>
                                    {authMode === 'login' ? 'Login' : 'Sign Up'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                            style={styles.authSwitchButton}
                        >
                            <Text style={styles.authSwitchText}>
                                {authMode === 'login'
                                    ? "Don't have an account? Sign Up"
                                    : 'Already have an account? Login'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function MainApp({ user }) {
    const [customers, setCustomers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [view, setView] = useState('dashboard');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [showAddTransaction, setShowAddTransaction] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [transactionDate, setTransactionDate] = useState(new Date());
    const [showReport, setShowReport] = useState(false);
    const [reportCustomer, setReportCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showProfile, setShowProfile] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [showEditCustomer, setShowEditCustomer] = useState(false);
    const [showEditTransaction, setShowEditTransaction] = useState(false);
    const [deletedItems, setDeletedItems] = useState([]);
    const [showRecycleBin, setShowRecycleBin] = useState(false);
    const [sortBy, setSortBy] = useState('date-desc');
    const [showSortOptions, setShowSortOptions] = useState(false);
    const [searchDate, setSearchDate] = useState(null);
    const [showDateSearch, setShowDateSearch] = useState(false);
    const [showCustomDateRange, setShowCustomDateRange] = useState(false);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [startDateText, setStartDateText] = useState('');
    const [endDateText, setEndDateText] = useState('');
    const [showTransactionDetail, setShowTransactionDetail] = useState(false);
    const [selectedTransactionDetail, setSelectedTransactionDetail] = useState(null);

    useEffect(() => {
        loadDataFromFirebase();
    }, [user]);

    // Handle Android back button
    useEffect(() => {
        const backAction = () => {
            // If any modal is open, close it
            if (showTransactionDetail) {
                setShowTransactionDetail(false);
                setSelectedTransactionDetail(null);
                return true;
            }
            if (showAddCustomer) {
                setShowAddCustomer(false);
                return true;
            }
            if (showAddTransaction) {
                setShowAddTransaction(false);
                return true;
            }
            if (showReport) {
                setShowReport(false);
                return true;
            }
            if (showProfile) {
                setShowProfile(false);
                return true;
            }
            if (showEditCustomer) {
                setShowEditCustomer(false);
                return true;
            }
            if (showEditTransaction) {
                setShowEditTransaction(false);
                return true;
            }
            if (showRecycleBin) {
                setShowRecycleBin(false);
                return true;
            }
            if (showCustomDateRange) {
                setShowCustomDateRange(false);
                return true;
            }

            // Navigate back through views
            if (view === 'customer-detail' && selectedCustomer) {
                setSelectedCustomer(null);
                setView('customers');
                return true;
            }
            if (view === 'customers' || view === 'transactions') {
                setView('dashboard');
                return true;
            }

            // If on dashboard, show exit confirmation
            if (view === 'dashboard') {
                Alert.alert(
                    'Exit App',
                    'Are you sure you want to exit?',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => {} },
                        { text: 'Exit', onPress: () => BackHandler.exitApp() }
                    ]
                );
                return true;
            }

            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

        return () => backHandler.remove();
    }, [
        view, 
        selectedCustomer, 
        showTransactionDetail,
        showAddCustomer, 
        showAddTransaction, 
        showReport, 
        showProfile, 
        showEditCustomer, 
        showEditTransaction, 
        showRecycleBin,
        showCustomDateRange
    ]);

    const loadDataFromFirebase = async () => {
        try {
            setLoading(true);

            const customersRef = collection(db, `users/${user.uid}/customers`);
            const customersSnapshot = await getDocs(customersRef);
            const customersData = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCustomers(customersData);

            const transactionsRef = collection(db, `users/${user.uid}/transactions`);
            const transactionsSnapshot = await getDocs(transactionsRef);
            const transactionsData = transactionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTransactions(transactionsData);

            // Load deleted items
            const deletedRef = collection(db, `users/${user.uid}/deleted`);
            const deletedSnapshot = await getDocs(deletedRef);
            const deletedData = deletedSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setDeletedItems(deletedData);
        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut(auth);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to logout');
                        }
                    }
                }
            ]
        );
    };

    const addCustomer = async (customer) => {
        try {
            const customersRef = collection(db, `users/${user.uid}/customers`);
            const docRef = await addDoc(customersRef, {
                ...customer,
                createdAt: new Date().toISOString()
            });

            const newCustomer = {
                id: docRef.id,
                ...customer,
                createdAt: new Date().toISOString()
            };

            setCustomers([...customers, newCustomer]);
            setShowAddCustomer(false);
        } catch (error) {
            console.error('Error adding customer:', error);
            Alert.alert('Error', 'Failed to add customer');
        }
    };

    const updateCustomer = async (customerId, updatedData) => {
        try {
            const customerRef = doc(db, `users/${user.uid}/customers`, customerId);
            await updateDoc(customerRef, updatedData);

            setCustomers(customers.map(c =>
                c.id === customerId ? { ...c, ...updatedData } : c
            ));
            setShowEditCustomer(false);
            setEditingCustomer(null);
            Alert.alert('Success', 'Customer updated successfully');
        } catch (error) {
            console.error('Error updating customer:', error);
            Alert.alert('Error', 'Failed to update customer');
        }
    };

    const deleteCustomer = (customerId) => {
        Alert.alert(
            'Delete Customer',
            'Are you sure you want to delete this customer and all their transactions?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const customer = customers.find(c => c.id === customerId);
                            const customerTransactions = transactions.filter(t => t.customerId === customerId);

                            // Move to recycle bin
                            const deletedRef = collection(db, `users/${user.uid}/deleted`);
                            const deletedDoc = await addDoc(deletedRef, {
                                type: 'customer',
                                data: customer,
                                relatedTransactions: customerTransactions,
                                deletedAt: new Date().toISOString()
                            });

                            console.log('Added to recycle bin:', deletedDoc.id);

                            // Delete from main collections
                            await deleteDoc(doc(db, `users/${user.uid}/customers`, customerId));
                            for (const txn of customerTransactions) {
                                await deleteDoc(doc(db, `users/${user.uid}/transactions`, txn.id));
                            }

                            setCustomers(customers.filter(c => c.id !== customerId));
                            setTransactions(transactions.filter(t => t.customerId !== customerId));

                            // Reload deleted items
                            await loadDataFromFirebase();

                            setView('dashboard');
                            Alert.alert('Success', 'Customer moved to recycle bin');
                        } catch (error) {
                            console.error('Error deleting customer:', error);
                            Alert.alert('Error', 'Failed to delete customer: ' + error.message);
                        }
                    }
                }
            ]
        );
    };

    const addTransaction = async (transaction) => {
        try {
            const transactionsRef = collection(db, `users/${user.uid}/transactions`);
            const docRef = await addDoc(transactionsRef, {
                customerId: selectedCustomer.id,
                ...transaction,
                transactionDate: transaction.transactionDate || new Date().toISOString(),
                createdAt: new Date().toISOString()
            });

            const newTxn = {
                id: docRef.id,
                customerId: selectedCustomer.id,
                ...transaction,
                transactionDate: transaction.transactionDate || new Date().toISOString(),
                createdAt: new Date().toISOString()
            };

            setTransactions([...transactions, newTxn]);
            setShowAddTransaction(false);
            setTransactionDate(new Date());

            // Send SMS notification
            if (selectedCustomer.phone) {
                sendSMS(selectedCustomer, transaction);
            }
        } catch (error) {
            console.error('Error adding transaction:', error);
            Alert.alert('Error', 'Failed to add transaction');
        }
    };

    const updateTransaction = async (txnId, updatedData) => {
        try {
            const txnRef = doc(db, `users/${user.uid}/transactions`, txnId);
            await updateDoc(txnRef, updatedData);

            setTransactions(transactions.map(t =>
                t.id === txnId ? { ...t, ...updatedData } : t
            ));
            setShowEditTransaction(false);
            setEditingTransaction(null);
            Alert.alert('Success', 'Transaction updated successfully');
        } catch (error) {
            console.error('Error updating transaction:', error);
            Alert.alert('Error', 'Failed to update transaction');
        }
    };

    const sendSMS = async (customer, transaction) => {
        if (!customer.phone || customer.phone.length < 10) {
            console.log('Invalid phone number');
            return;
        }

        try {
            const message = `Transaction Alert: ${transaction.type === 'credit' ? 'Received' : 'Given'} ₹${transaction.amount}${transaction.description ? ` for ${transaction.description}` : ''}. Thank you! - Finance Manager`;

            // Using Linking to open SMS app with pre-filled message
            const { Linking } = require('react-native');
            const smsUrl = Platform.OS === 'ios'
                ? `sms:${customer.phone}&body=${encodeURIComponent(message)}`
                : `sms:${customer.phone}?body=${encodeURIComponent(message)}`;

            const canOpen = await Linking.canOpenURL(smsUrl);
            if (canOpen) {
                await Linking.openURL(smsUrl);
            } else {
                Alert.alert('SMS Not Available', 'Cannot send SMS on this device');
            }
        } catch (error) {
            console.error('Error sending SMS:', error);
            Alert.alert('SMS Error', 'Could not open SMS app. Please check permissions.');
        }
    };

    const deleteTransaction = (txnId) => {
        Alert.alert(
            'Delete Transaction',
            'Are you sure you want to delete this transaction?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const transaction = transactions.find(t => t.id === txnId);

                            // Move to recycle bin
                            const deletedRef = collection(db, `users/${user.uid}/deleted`);
                            const deletedDoc = await addDoc(deletedRef, {
                                type: 'transaction',
                                data: transaction,
                                deletedAt: new Date().toISOString()
                            });

                            console.log('Transaction added to recycle bin:', deletedDoc.id);

                            await deleteDoc(doc(db, `users/${user.uid}/transactions`, txnId));
                            setTransactions(transactions.filter(t => t.id !== txnId));

                            // Reload deleted items
                            await loadDataFromFirebase();

                            Alert.alert('Success', 'Transaction moved to recycle bin');
                        } catch (error) {
                            console.error('Error deleting transaction:', error);
                            Alert.alert('Error', 'Failed to delete transaction: ' + error.message);
                        }
                    }
                }
            ]
        );
    };

    const restoreItem = async (item) => {
        Alert.alert(
            'Restore Item',
            `Are you sure you want to restore this ${item.type}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Restore',
                    onPress: async () => {
                        try {
                            if (item.type === 'customer') {
                                // Restore customer
                                const customersRef = collection(db, `users/${user.uid}/customers`);
                                const docRef = await addDoc(customersRef, item.data);

                                // Restore related transactions
                                if (item.relatedTransactions && item.relatedTransactions.length > 0) {
                                    const transactionsRef = collection(db, `users/${user.uid}/transactions`);
                                    for (const txn of item.relatedTransactions) {
                                        await addDoc(transactionsRef, txn);
                                    }
                                }

                                // Remove from recycle bin
                                await deleteDoc(doc(db, `users/${user.uid}/deleted`, item.id));

                                // Reload data
                                await loadDataFromFirebase();
                                Alert.alert('Success', 'Customer and transactions restored successfully');
                            } else if (item.type === 'transaction') {
                                // Restore transaction
                                const transactionsRef = collection(db, `users/${user.uid}/transactions`);
                                await addDoc(transactionsRef, item.data);

                                // Remove from recycle bin
                                await deleteDoc(doc(db, `users/${user.uid}/deleted`, item.id));

                                // Reload data
                                await loadDataFromFirebase();
                                Alert.alert('Success', 'Transaction restored successfully');
                            }
                        } catch (error) {
                            console.error('Error restoring item:', error);
                            Alert.alert('Error', 'Failed to restore item: ' + error.message);
                        }
                    }
                }
            ]
        );
    };

    const getCustomerBalance = (customerId) => {
        return transactions
            .filter(t => t.customerId === customerId)
            .reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0);
    };

    const getTotalBalance = () => {
        return transactions.reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0);
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

    const getSortedTransactions = (txns) => {
        let sorted = [...txns];

        switch (sortBy) {
            case 'date-desc':
                sorted.sort((a, b) => {
                    const dateA = new Date(a.transactionDate || a.createdAt);
                    const dateB = new Date(b.transactionDate || b.createdAt);
                    return dateB - dateA;
                });
                break;
            case 'date-asc':
                sorted.sort((a, b) => {
                    const dateA = new Date(a.transactionDate || a.createdAt);
                    const dateB = new Date(b.transactionDate || b.createdAt);
                    return dateA - dateB;
                });
                break;
            case 'amount-desc':
                sorted.sort((a, b) => b.amount - a.amount);
                break;
            case 'amount-asc':
                sorted.sort((a, b) => a.amount - b.amount);
                break;
            case 'type-credit':
                sorted = sorted.filter(t => t.type === 'credit');
                break;
            case 'type-debit':
                sorted = sorted.filter(t => t.type === 'debit');
                break;
        }

        return sorted;
    };

    const filteredTransactions = getSortedTransactions(
        transactions
            .filter(t => selectedCustomer ? t.customerId === selectedCustomer.id : true)
            .filter(t => filterType === 'all' ? true : t.type === filterType)
            .filter(t => {
                if (searchDate) {
                    const txnDate = new Date(t.transactionDate || t.createdAt);
                    return txnDate.toDateString() === searchDate.toDateString();
                }
                if (startDate && endDate) {
                    const txnDate = new Date(t.transactionDate || t.createdAt);
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                    return txnDate >= start && txnDate <= end;
                }
                return true;
            })
    );

    const totalCredit = transactions.reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : 0), 0);
    const totalDebit = transactions.reduce((sum, t) => sum + (t.type === 'debit' ? t.amount : 0), 0);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Loading your data...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar 
                barStyle="light-content" 
                backgroundColor="#3B82F6"
                translucent={false}
            />

            <View style={styles.header}>
                <View style={styles.headerTop}>
                    {(view !== 'dashboard' || selectedCustomer) && (
                        <TouchableOpacity
                            onPress={() => {
                                if (view === 'customer-detail') {
                                    setSelectedCustomer(null);
                                    setView('customers');
                                } else {
                                    setView('dashboard');
                                }
                            }}
                            style={styles.backButton}
                        >
                            <Feather name="arrow-left" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <Text style={styles.headerTitle}>Finance Manager</Text>
                    <TouchableOpacity onPress={() => setShowProfile(true)} style={styles.profileButton}>
                        <Feather name="user" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        onPress={() => setView('dashboard')}
                        style={[styles.tab, view === 'dashboard' && styles.tabActive]}
                    >
                        <Text style={[styles.tabText, view === 'dashboard' && styles.tabTextActive]}>Dashboard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setView('customers')}
                        style={[styles.tab, view === 'customers' && styles.tabActive]}
                    >
                        <Text style={[styles.tabText, view === 'customers' && styles.tabTextActive]}>Customers</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setView('transactions')}
                        style={[styles.tab, view === 'transactions' && styles.tabActive]}
                    >
                        <Text style={[styles.tabText, view === 'transactions' && styles.tabTextActive]}>Transactions</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {view === 'dashboard' && (
                    <View style={styles.section}>
                        <View style={styles.userInfoCard}>
                            <Feather name="user" size={20} color="#3B82F6" />
                            <Text style={styles.userEmail}>{user.email}</Text>
                        </View>

                        <View style={styles.summaryContainer}>
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryLabel}>Net Balance</Text>
                                <Text style={[styles.summaryAmount, getTotalBalance() >= 0 ? styles.positiveAmount : styles.negativeAmount]}>
                                    ₹{Math.abs(getTotalBalance()).toLocaleString()}
                                </Text>
                                <Feather name={getTotalBalance() >= 0 ? "trending-up" : "trending-down"} size={24} color={getTotalBalance() >= 0 ? "#10B981" : "#EF4444"} />
                            </View>
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryLabel}>Given</Text>
                                <Text style={[styles.summaryAmount, styles.negativeAmount]}>₹{totalDebit.toLocaleString()}</Text>
                                <Feather name="trending-down" size={24} color="#EF4444" />
                            </View>
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryLabel}>Got</Text>
                                <Text style={[styles.summaryAmount, styles.positiveAmount]}>₹{totalCredit.toLocaleString()}</Text>
                                <Feather name="trending-up" size={24} color="#10B981" />
                            </View>
                        </View>

                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Recent Customers</Text>
                                <TouchableOpacity onPress={() => setShowAddCustomer(true)} style={styles.addButton}>
                                    <Feather name="plus" size={20} color="#fff" />
                                    <Text style={styles.addButtonText}>Add</Text>
                                </TouchableOpacity>
                            </View>
                            {customers.slice(0, 5).map(customer => {
                                const balance = getCustomerBalance(customer.id);
                                return (
                                    <TouchableOpacity
                                        key={customer.id}
                                        onPress={() => {
                                            setSelectedCustomer(customer);
                                            setView('customer-detail');
                                        }}
                                        style={styles.listItem}
                                    >
                                        <View style={styles.listItemLeft}>
                                            <View style={styles.avatar}>
                                                <Feather name="user" size={24} color="#3B82F6" />
                                            </View>
                                            <View>
                                                <Text style={styles.listItemTitle}>{customer.name}</Text>
                                                {customer.phone && <Text style={styles.listItemSubtitle}>{customer.phone}</Text>}
                                            </View>
                                        </View>
                                        <View style={styles.listItemRight}>
                                            <Text style={[styles.balanceAmount, balance >= 0 ? styles.positiveAmount : styles.negativeAmount]}>
                                                ₹{Math.abs(balance).toLocaleString()}
                                            </Text>
                                            <Text style={styles.balanceLabel}>{balance >= 0 ? 'Got' : 'Given'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {customers.length === 0 && (
                                <Text style={styles.emptyText}>No customers yet. Add your first customer!</Text>
                            )}
                        </View>
                    </View>
                )}

                {view === 'customers' && (
                    <View style={styles.section}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>All Customers</Text>
                                <TouchableOpacity onPress={() => setShowAddCustomer(true)} style={styles.addButton}>
                                    <Feather name="plus" size={20} color="#fff" />
                                    <Text style={styles.addButtonText}>Add</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.searchContainer}>
                                <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search customers..."
                                    value={searchTerm}
                                    onChangeText={setSearchTerm}
                                />
                            </View>
                            {filteredCustomers.map(customer => {
                                const balance = getCustomerBalance(customer.id);
                                return (
                                    <View key={customer.id} style={styles.listItem}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedCustomer(customer);
                                                setView('customer-detail');
                                            }}
                                            style={styles.listItemLeft}
                                        >
                                            <View style={styles.avatar}>
                                                <Feather name="user" size={24} color="#3B82F6" />
                                            </View>
                                            <View>
                                                <Text style={styles.listItemTitle}>{customer.name}</Text>
                                                {customer.phone && (
                                                    <View style={styles.phoneContainer}>
                                                        <Feather name="phone" size={12} color="#9CA3AF" />
                                                        <Text style={styles.listItemSubtitle}>{customer.phone}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                        <View style={styles.listItemRight}>
                                            <Text style={[styles.balanceAmount, balance >= 0 ? styles.positiveAmount : styles.negativeAmount]}>
                                                ₹{Math.abs(balance).toLocaleString()}
                                            </Text>
                                            <Text style={styles.balanceLabel}>{balance >= 0 ? 'Got' : 'Given'}</Text>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setEditingCustomer(customer);
                                                    setShowEditCustomer(true);
                                                }}
                                                style={styles.editIconButton}
                                            >
                                                <Feather name="edit-2" size={18} color="#3B82F6" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                            {filteredCustomers.length === 0 && (
                                <Text style={styles.emptyText}>No customers found.</Text>
                            )}
                        </View>
                    </View>
                )}

                {view === 'customer-detail' && selectedCustomer && (
                    <View style={styles.section}>
                        <View style={styles.card}>
                            <View style={styles.customerDetailHeader}>
                                <View>
                                    <Text style={styles.customerName}>{selectedCustomer.name}</Text>
                                    {selectedCustomer.phone && (
                                        <View style={styles.phoneContainer}>
                                            <Feather name="phone" size={16} color="#6B7280" />
                                            <Text style={styles.customerPhone}>{selectedCustomer.phone}</Text>
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => deleteCustomer(selectedCustomer.id)}>
                                    <Feather name="trash-2" size={20} color="#EF4444" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.balanceCard}>
                                <Text style={styles.balanceCardLabel}>Total Balance</Text>
                                <Text style={[styles.balanceCardAmount, getCustomerBalance(selectedCustomer.id) >= 0 ? styles.positiveAmount : styles.negativeAmount]}>
                                    ₹{Math.abs(getCustomerBalance(selectedCustomer.id)).toLocaleString()}
                                </Text>
                                <Text style={styles.balanceCardSubtitle}>
                                    {getCustomerBalance(selectedCustomer.id) >= 0 ? 'Got' : 'Given'}
                                </Text>
                            </View>

                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    onPress={() => setShowAddTransaction(true)}
                                    style={styles.addCreditButton}
                                >
                                    <Feather name="plus-circle" size={20} color="#fff" />
                                    <Text style={styles.addCreditButtonText}>Add Credit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setReportCustomer(selectedCustomer);
                                        setShowReport(true);
                                    }}
                                    style={styles.reportButton}
                                >
                                    <Feather name="file-text" size={20} color="#3B82F6" />
                                    <Text style={styles.reportButtonText}>Report</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Transaction History</Text>
                                <View style={styles.filterContainer}>
                                    <TouchableOpacity onPress={() => setShowSortOptions(!showSortOptions)} style={styles.iconButton}>
                                        <Feather name="sliders" size={20} color="#3B82F6" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setShowDateSearch(!showDateSearch)} style={styles.iconButton}>
                                        <Feather name="calendar" size={20} color="#3B82F6" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.filterButtonsRow}>
                                <TouchableOpacity onPress={() => setFilterType('all')} style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}>
                                    <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>All</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setFilterType('credit')} style={[styles.filterButton, filterType === 'credit' && styles.filterButtonActive]}>
                                    <Text style={[styles.filterButtonText, filterType === 'credit' && styles.filterButtonTextActive]}>Credit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setFilterType('debit')} style={[styles.filterButton, filterType === 'debit' && styles.filterButtonActive]}>
                                    <Text style={[styles.filterButtonText, filterType === 'debit' && styles.filterButtonTextActive]}>Debit</Text>
                                </TouchableOpacity>
                            </View>

                            {showSortOptions && (
                                <View style={styles.sortOptions}>
                                    <TouchableOpacity onPress={() => { setSortBy('date-desc'); setShowSortOptions(false); }} style={styles.sortOption}>
                                        <Text style={styles.sortOptionText}>Date (Newest First)</Text>
                                        {sortBy === 'date-desc' && <Feather name="check" size={16} color="#3B82F6" />}
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { setSortBy('date-asc'); setShowSortOptions(false); }} style={styles.sortOption}>
                                        <Text style={styles.sortOptionText}>Date (Oldest First)</Text>
                                        {sortBy === 'date-asc' && <Feather name="check" size={16} color="#3B82F6" />}
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { setSortBy('amount-desc'); setShowSortOptions(false); }} style={styles.sortOption}>
                                        <Text style={styles.sortOptionText}>Amount (High to Low)</Text>
                                        {sortBy === 'amount-desc' && <Feather name="check" size={16} color="#3B82F6" />}
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { setSortBy('amount-asc'); setShowSortOptions(false); }} style={styles.sortOption}>
                                        <Text style={styles.sortOptionText}>Amount (Low to High)</Text>
                                        {sortBy === 'amount-asc' && <Feather name="check" size={16} color="#3B82F6" />}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {showDateSearch && (
                                <View style={styles.dateSearchContainer}>
                                    <Text style={styles.dateSearchLabel}>Search by Date:</Text>
                                    <View style={styles.dateSearchButtons}>
                                        <TouchableOpacity onPress={() => {
                                            setSearchDate(new Date());
                                            setStartDate(null);
                                            setEndDate(null);
                                        }} style={styles.dateSearchButton}>
                                            <Text style={styles.dateSearchButtonText}>Today</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => {
                                            const yesterday = new Date();
                                            yesterday.setDate(yesterday.getDate() - 1);
                                            setSearchDate(yesterday);
                                            setStartDate(null);
                                            setEndDate(null);
                                        }} style={styles.dateSearchButton}>
                                            <Text style={styles.dateSearchButtonText}>Yesterday</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowCustomDateRange(true);
                                                setSearchDate(null);
                                            }}
                                            style={[styles.dateSearchButton, styles.customRangeButton]}
                                        >
                                            <Text style={styles.dateSearchButtonText}>Custom Range</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {searchDate && (
                                        <View style={styles.activeDateFilter}>
                                            <Text style={styles.selectedDateText}>
                                                Showing: {searchDate.toLocaleDateString()}
                                            </Text>
                                            <TouchableOpacity onPress={() => setSearchDate(null)}>
                                                <Feather name="x" size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    {startDate && endDate && (
                                        <View style={styles.activeDateFilter}>
                                            <Text style={styles.selectedDateText}>
                                                Range: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                                            </Text>
                                            <TouchableOpacity onPress={() => {
                                                setStartDate(null);
                                                setEndDate(null);
                                            }}>
                                                <Feather name="x" size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            )}

                            {showCustomDateRange && (
                                <View style={styles.customDateRangeContainer}>
                                    <Text style={styles.customDateRangeTitle}>Select Date Range</Text>

                                    <View style={styles.dateRangePicker}>
                                        <View style={styles.datePickerGroup}>
                                            <Text style={styles.datePickerLabel}>Start Date</Text>
                                            <TextInput
                                                style={styles.dateInputField}
                                                placeholder="DD/MM/YYYY"
                                                value={startDateText}
                                                onChangeText={(text) => {
                                                    // Auto-add slashes
                                                    let formatted = text.replace(/[^0-9]/g, '');
                                                    if (formatted.length >= 2) {
                                                        formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                                                    }
                                                    if (formatted.length >= 5) {
                                                        formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
                                                    }
                                                    formatted = formatted.slice(0, 10);
                                                    setStartDateText(formatted);

                                                    // Auto-parse when complete
                                                    if (formatted.length === 10) {
                                                        const parts = formatted.split('/');
                                                        if (parts.length === 3) {
                                                            const day = parseInt(parts[0]);
                                                            const month = parseInt(parts[1]) - 1;
                                                            const year = parseInt(parts[2]);
                                                            if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1900) {
                                                                const date = new Date(year, month, day);
                                                                if (date.getDate() === day && date.getMonth() === month) {
                                                                    setStartDate(date);
                                                                }
                                                            }
                                                        }
                                                    }
                                                }}
                                                maxLength={10}
                                                keyboardType="number-pad"
                                            />

                                            <TouchableOpacity
                                                onPress={() => setShowStartDatePicker(!showStartDatePicker)}
                                                style={styles.quickSelectButton}
                                            >
                                                <Feather name="calendar" size={16} color="#3B82F6" />
                                                <Text style={styles.quickSelectText}>Quick Select</Text>
                                            </TouchableOpacity>

                                            {showStartDatePicker && (
                                                <View style={styles.datePickerQuickOptions}>
                                                    <TouchableOpacity onPress={() => {
                                                        const weekAgo = new Date();
                                                        weekAgo.setDate(weekAgo.getDate() - 7);
                                                        setStartDate(weekAgo);
                                                        setStartDateText(weekAgo.toLocaleDateString('en-GB'));
                                                        setShowStartDatePicker(false);
                                                    }} style={styles.quickOptionButton}>
                                                        <Text style={styles.quickOptionText}>Last Week</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => {
                                                        const monthAgo = new Date();
                                                        monthAgo.setMonth(monthAgo.getMonth() - 1);
                                                        setStartDate(monthAgo);
                                                        setStartDateText(monthAgo.toLocaleDateString('en-GB'));
                                                        setShowStartDatePicker(false);
                                                    }} style={styles.quickOptionButton}>
                                                        <Text style={styles.quickOptionText}>Last Month</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => {
                                                        const threeMonthsAgo = new Date();
                                                        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                                                        setStartDate(threeMonthsAgo);
                                                        setStartDateText(threeMonthsAgo.toLocaleDateString('en-GB'));
                                                        setShowStartDatePicker(false);
                                                    }} style={styles.quickOptionButton}>
                                                        <Text style={styles.quickOptionText}>Last 3 Months</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>

                                        <View style={styles.datePickerGroup}>
                                            <Text style={styles.datePickerLabel}>End Date</Text>
                                            <TextInput
                                                style={styles.dateInputField}
                                                placeholder="DD/MM/YYYY"
                                                value={endDateText}
                                                onChangeText={(text) => {
                                                    // Auto-add slashes
                                                    let formatted = text.replace(/[^0-9]/g, '');
                                                    if (formatted.length >= 2) {
                                                        formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                                                    }
                                                    if (formatted.length >= 5) {
                                                        formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
                                                    }
                                                    formatted = formatted.slice(0, 10);
                                                    setEndDateText(formatted);

                                                    // Auto-parse when complete
                                                    if (formatted.length === 10) {
                                                        const parts = formatted.split('/');
                                                        if (parts.length === 3) {
                                                            const day = parseInt(parts[0]);
                                                            const month = parseInt(parts[1]) - 1;
                                                            const year = parseInt(parts[2]);
                                                            if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1900) {
                                                                const date = new Date(year, month, day);
                                                                if (date.getDate() === day && date.getMonth() === month) {
                                                                    setEndDate(date);
                                                                }
                                                            }
                                                        }
                                                    }
                                                }}
                                                maxLength={10}
                                                keyboardType="number-pad"
                                            />

                                            <TouchableOpacity
                                                onPress={() => setShowEndDatePicker(!showEndDatePicker)}
                                                style={styles.quickSelectButton}
                                            >
                                                <Feather name="calendar" size={16} color="#3B82F6" />
                                                <Text style={styles.quickSelectText}>Quick Select</Text>
                                            </TouchableOpacity>

                                            {showEndDatePicker && (
                                                <View style={styles.datePickerQuickOptions}>
                                                    <TouchableOpacity onPress={() => {
                                                        setEndDate(new Date());
                                                        setEndDateText(new Date().toLocaleDateString('en-GB'));
                                                        setShowEndDatePicker(false);
                                                    }} style={styles.quickOptionButton}>
                                                        <Text style={styles.quickOptionText}>Today</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => {
                                                        const yesterday = new Date();
                                                        yesterday.setDate(yesterday.getDate() - 1);
                                                        setEndDate(yesterday);
                                                        setEndDateText(yesterday.toLocaleDateString('en-GB'));
                                                        setShowEndDatePicker(false);
                                                    }} style={styles.quickOptionButton}>
                                                        <Text style={styles.quickOptionText}>Yesterday</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.customDateRangeActions}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowCustomDateRange(false);
                                                setStartDate(null);
                                                setEndDate(null);
                                                setStartDateText('');
                                                setEndDateText('');
                                                setShowStartDatePicker(false);
                                                setShowEndDatePicker(false);
                                            }}
                                            style={[styles.button, styles.buttonSecondary]}
                                        >
                                            <Text style={styles.buttonSecondaryText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (startDate && endDate) {
                                                    if (startDate > endDate) {
                                                        Alert.alert('Error', 'Start date must be before end date');
                                                        return;
                                                    }
                                                    setShowCustomDateRange(false);
                                                    setSearchDate(null);
                                                    setShowStartDatePicker(false);
                                                    setShowEndDatePicker(false);
                                                } else {
                                                    Alert.alert('Error', 'Please enter both start and end dates');
                                                }
                                            }}
                                            style={[styles.button, styles.buttonPrimary]}
                                        >
                                            <Text style={styles.buttonPrimaryText}>Apply</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {filteredTransactions.map(txn => (
                                <TouchableOpacity 
                                    key={txn.id} 
                                    style={styles.transactionItem}
                                    onPress={() => {
                                        setSelectedTransactionDetail(txn);
                                        setShowTransactionDetail(true);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.transactionLeft}>
                                        <View style={[styles.transactionIcon, txn.type === 'credit' ? styles.creditIcon : styles.debitIcon]}>
                                            <Feather name={txn.type === 'credit' ? "trending-up" : "trending-down"} size={20} color={txn.type === 'credit' ? "#10B981" : "#EF4444"} />
                                        </View>
                                        <View style={styles.transactionTextContainer}>
                                            <Text 
                                                style={styles.transactionDescription}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                            >
                                                {txn.description || (txn.type === 'credit' ? 'Payment Received' : 'Payment Given')}
                                            </Text>
                                            <View style={styles.transactionDate}>
                                                <Feather name="calendar" size={12} color="#9CA3AF" />
                                                <Text style={styles.transactionDateText}>
                                                    {new Date(txn.transactionDate || txn.createdAt).toLocaleDateString()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.transactionRight}>
                                        <Text style={[styles.transactionAmount, txn.type === 'credit' ? styles.positiveAmount : styles.negativeAmount]}>
                                            {txn.type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString()}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <Text style={styles.emptyText}>No transactions yet.</Text>
                            )}
                        </View>
                    </View>
                )}

                {view === 'transactions' && (
                    <View style={styles.section}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>All Transactions</Text>
                            </View>

                            <View style={styles.filterButtonsRow}>
                                <TouchableOpacity onPress={() => setFilterType('all')} style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}>
                                    <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>All</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setFilterType('credit')} style={[styles.filterButton, filterType === 'credit' && styles.filterButtonActive]}>
                                    <Text style={[styles.filterButtonText, filterType === 'credit' && styles.filterButtonTextActive]}>Credit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setFilterType('debit')} style={[styles.filterButton, filterType === 'debit' && styles.filterButtonActive]}>
                                    <Text style={[styles.filterButtonText, filterType === 'debit' && styles.filterButtonTextActive]}>Debit</Text>
                                </TouchableOpacity>
                            </View>

                            {filteredTransactions.map(txn => {
                                const customer = customers.find(c => c.id === txn.customerId);
                                return (
                                    <TouchableOpacity 
                                        key={txn.id} 
                                        style={styles.transactionItem}
                                        onPress={() => {
                                            setSelectedTransactionDetail(txn);
                                            setShowTransactionDetail(true);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.transactionLeft}>
                                            <View style={[styles.transactionIcon, txn.type === 'credit' ? styles.creditIcon : styles.debitIcon]}>
                                                <Feather name={txn.type === 'credit' ? "trending-up" : "trending-down"} size={20} color={txn.type === 'credit' ? "#10B981" : "#EF4444"} />
                                            </View>
                                            <View style={styles.transactionTextContainer}>
                                                <Text style={styles.transactionCustomer}>{customer?.name || 'Unknown'}</Text>
                                                <Text 
                                                    style={styles.transactionDescription}
                                                    numberOfLines={1}
                                                    ellipsizeMode="tail"
                                                >
                                                    {txn.description || (txn.type === 'credit' ? 'Payment Received' : 'Payment Given')}
                                                </Text>
                                                <View style={styles.transactionDate}>
                                                    <Feather name="calendar" size={12} color="#9CA3AF" />
                                                    <Text style={styles.transactionDateText}>
                                                        {new Date(txn.transactionDate || txn.createdAt).toLocaleDateString()}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.transactionRight}>
                                            <Text style={[styles.transactionAmount, txn.type === 'credit' ? styles.positiveAmount : styles.negativeAmount]}>
                                                {txn.type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString()}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {filteredTransactions.length === 0 && (
                                <Text style={styles.emptyText}>No transactions found.</Text>
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            <Modal visible={showAddCustomer} animationType="slide" transparent={true}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                                <View style={styles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>Add Customer</Text>
                                        <TouchableOpacity onPress={() => {
                                            Keyboard.dismiss();
                                            setShowAddCustomer(false);
                                        }}>
                                            <Feather name="x" size={24} color="#6B7280" />
                                        </TouchableOpacity>
                                    </View>
                                    <CustomerForm onSubmit={addCustomer} onCancel={() => {
                                        Keyboard.dismiss();
                                        setShowAddCustomer(false);
                                    }} />
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={showAddTransaction} animationType="slide" transparent={true}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                                <View style={styles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>Add Transaction</Text>
                                        <TouchableOpacity onPress={() => {
                                            Keyboard.dismiss();
                                            setShowAddTransaction(false);
                                            setTransactionDate(new Date());
                                        }}>
                                            <Feather name="x" size={24} color="#6B7280" />
                                        </TouchableOpacity>
                                    </View>
                                    <TransactionForm
                                        onSubmit={addTransaction}
                                        onCancel={() => {
                                            Keyboard.dismiss();
                                            setShowAddTransaction(false);
                                            setTransactionDate(new Date());
                                        }}
                                        transactionDate={transactionDate}
                                        setTransactionDate={setTransactionDate}
                                    />
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={showReport} animationType="slide" transparent={false}>
                <SafeAreaView style={styles.reportContainer}>
                    <View style={styles.reportHeader}>
                        <TouchableOpacity onPress={() => setShowReport(false)} style={styles.reportCloseButton}>
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.reportHeaderTitle}>Transaction Report</Text>
                    </View>
                    <CustomerReport
                        customer={reportCustomer}
                        transactions={transactions.filter(t => t.customerId === reportCustomer?.id)}
                        onClose={() => setShowReport(false)}
                    />
                </SafeAreaView>
            </Modal>

            <Modal visible={showProfile} animationType="slide" transparent={true}>
                <View style={styles.profileModalOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowProfile(false)}>
                        <View style={styles.profileModalBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={styles.profileModalContent}>
                        <View style={styles.profileHeader}>
                            <Text style={styles.profileHeaderTitle}>Profile</Text>
                            <TouchableOpacity onPress={() => setShowProfile(false)}>
                                <Feather name="x" size={24} color="#1F2937" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.profileScrollView} showsVerticalScrollIndicator={true}>
                            <View style={styles.profileContent}>
                                <View style={styles.profileAvatarContainer}>
                                    <View style={styles.profileAvatar}>
                                        <Feather name="user" size={48} color="#3B82F6" />
                                    </View>
                                </View>

                                <View style={styles.profileInfoSection}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setShowProfile(false);
                                            setShowRecycleBin(true);
                                        }}
                                        style={styles.recycleBinButton}
                                    >
                                        <Feather name="trash-2" size={20} color="#fff" />
                                        <Text style={styles.recycleBinButtonText}>
                                            Recycle Bin ({deletedItems.length})
                                        </Text>
                                    </TouchableOpacity>

                                    <View style={styles.profileInfoItem}>
                                        <View style={styles.profileInfoIcon}>
                                            <Feather name="mail" size={20} color="#3B82F6" />
                                        </View>
                                        <View style={styles.profileInfoText}>
                                            <Text style={styles.profileInfoLabel}>Email</Text>
                                            <Text style={styles.profileInfoValue}>{user.email}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.profileInfoItem}>
                                        <View style={styles.profileInfoIcon}>
                                            <Feather name="calendar" size={20} color="#3B82F6" />
                                        </View>
                                        <View style={styles.profileInfoText}>
                                            <Text style={styles.profileInfoLabel}>Member Since</Text>
                                            <Text style={styles.profileInfoValue}>
                                                {user.metadata?.creationTime
                                                    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })
                                                    : 'N/A'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.profileInfoItem}>
                                        <View style={styles.profileInfoIcon}>
                                            <Feather name="clock" size={20} color="#3B82F6" />
                                        </View>
                                        <View style={styles.profileInfoText}>
                                            <Text style={styles.profileInfoLabel}>Last Sign In</Text>
                                            <Text style={styles.profileInfoValue}>
                                                {user.metadata?.lastSignInTime
                                                    ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })
                                                    : 'N/A'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.profileInfoItem}>
                                        <View style={styles.profileInfoIcon}>
                                            <Feather name="users" size={20} color="#3B82F6" />
                                        </View>
                                        <View style={styles.profileInfoText}>
                                            <Text style={styles.profileInfoLabel}>Total Customers</Text>
                                            <Text style={styles.profileInfoValue}>{customers.length}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.profileInfoItem}>
                                        <View style={styles.profileInfoIcon}>
                                            <Feather name="activity" size={20} color="#3B82F6" />
                                        </View>
                                        <View style={styles.profileInfoText}>
                                            <Text style={styles.profileInfoLabel}>Total Transactions</Text>
                                            <Text style={styles.profileInfoValue}>{transactions.length}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.profileInfoItem}>
                                        <View style={styles.profileInfoIcon}>
                                            <Feather name="trending-up" size={20} color="#10B981" />
                                        </View>
                                        <View style={styles.profileInfoText}>
                                            <Text style={styles.profileInfoLabel}>Net Balance</Text>
                                            <Text style={[
                                                styles.profileInfoValue,
                                                getTotalBalance() >= 0 ? styles.positiveAmount : styles.negativeAmount
                                            ]}>
                                                ₹{Math.abs(getTotalBalance()).toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity onPress={handleLogout} style={styles.logoutButtonLarge}>
                                    <Feather name="log-out" size={20} color="#fff" />
                                    <Text style={styles.logoutButtonText}>Logout</Text>
                                </TouchableOpacity>

                                <Text style={styles.profileVersionText}>Version 1.0.0</Text>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={showEditCustomer} animationType="slide" transparent={true}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                                <View style={styles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>Edit Customer</Text>
                                        <TouchableOpacity onPress={() => {
                                            Keyboard.dismiss();
                                            setShowEditCustomer(false);
                                            setEditingCustomer(null);
                                        }}>
                                            <Feather name="x" size={24} color="#6B7280" />
                                        </TouchableOpacity>
                                    </View>
                                    {editingCustomer && (
                                        <CustomerForm
                                            onSubmit={(data) => updateCustomer(editingCustomer.id, data)}
                                            onCancel={() => {
                                                Keyboard.dismiss();
                                                setShowEditCustomer(false);
                                                setEditingCustomer(null);
                                            }}
                                            initialData={editingCustomer}
                                        />
                                    )}
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={showEditTransaction} animationType="slide" transparent={true}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                                <View style={styles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>Edit Transaction</Text>
                                        <TouchableOpacity onPress={() => {
                                            Keyboard.dismiss();
                                            setShowEditTransaction(false);
                                            setEditingTransaction(null);
                                        }}>
                                            <Feather name="x" size={24} color="#6B7280" />
                                        </TouchableOpacity>
                                    </View>
                                    {editingTransaction && (
                                        <TransactionForm
                                            onSubmit={(data) => updateTransaction(editingTransaction.id, data)}
                                            onCancel={() => {
                                                Keyboard.dismiss();
                                                setShowEditTransaction(false);
                                                setEditingTransaction(null);
                                            }}
                                            transactionDate={new Date(editingTransaction.transactionDate || editingTransaction.createdAt)}
                                            setTransactionDate={setTransactionDate}
                                            initialData={editingTransaction}
                                        />
                                    )}
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={showRecycleBin} animationType="slide" transparent={false}>
                <SafeAreaView style={styles.reportContainer}>
                    <View style={styles.reportHeader}>
                        <TouchableOpacity onPress={() => setShowRecycleBin(false)} style={styles.reportCloseButton}>
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.reportHeaderTitle}>Recycle Bin</Text>
                    </View>
                    <ScrollView style={styles.reportContent}>
                        {deletedItems.length === 0 ? (
                            <Text style={styles.emptyText}>No deleted items</Text>
                        ) : (
                            deletedItems.map((item) => (
                                <View key={item.id} style={styles.deletedItem}>
                                    <View style={styles.deletedItemLeft}>
                                        <Feather
                                            name={item.type === 'customer' ? 'user' : 'activity'}
                                            size={24}
                                            color="#EF4444"
                                        />
                                        <View style={styles.deletedItemInfo}>
                                            <Text style={styles.deletedItemTitle}>
                                                {item.type === 'customer' ? item.data.name : `Transaction - ₹${item.data.amount}`}
                                            </Text>
                                            <Text style={styles.deletedItemDate}>
                                                Deleted: {new Date(item.deletedAt).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.deletedItemActions}>
                                        <TouchableOpacity
                                            onPress={() => restoreItem(item)}
                                            style={styles.restoreButton}
                                        >
                                            <Feather name="rotate-ccw" size={20} color="#10B981" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                Alert.alert(
                                                    'Permanently Delete',
                                                    'This will permanently delete this item. Continue?',
                                                    [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        {
                                                            text: 'Delete',
                                                            style: 'destructive',
                                                            onPress: async () => {
                                                                try {
                                                                    await deleteDoc(doc(db, `users/${user.uid}/deleted`, item.id));
                                                                    setDeletedItems(deletedItems.filter(d => d.id !== item.id));
                                                                    Alert.alert('Success', 'Item permanently deleted');
                                                                } catch (error) {
                                                                    Alert.alert('Error', 'Failed to delete item');
                                                                }
                                                            }
                                                        }
                                                    ]
                                                );
                                            }}
                                        >
                                            <Feather name="x-circle" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            <Modal visible={showTransactionDetail} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedTransactionDetail && (
                            <>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Transaction Details</Text>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setShowTransactionDetail(false);
                                            setSelectedTransactionDetail(null);
                                        }}
                                    >
                                        <Feather name="x" size={24} color="#6B7280" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.transactionDetailContent}>
                                    {/* Transaction Type Badge */}
                                    <View style={styles.transactionDetailBadge}>
                                        <View style={[
                                            styles.transactionTypeBadge,
                                            selectedTransactionDetail.type === 'credit' ? styles.creditBadge : styles.debitBadge
                                        ]}>
                                            <Feather 
                                                name={selectedTransactionDetail.type === 'credit' ? "trending-up" : "trending-down"} 
                                                size={24} 
                                                color={selectedTransactionDetail.type === 'credit' ? "#10B981" : "#EF4444"} 
                                            />
                                            <Text style={[
                                                styles.transactionTypeBadgeText,
                                                selectedTransactionDetail.type === 'credit' ? styles.creditText : styles.debitText
                                            ]}>
                                                {selectedTransactionDetail.type === 'credit' ? 'CREDIT' : 'DEBIT'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Amount */}
                                    <View style={styles.transactionDetailRow}>
                                        <Text style={styles.transactionDetailLabel}>Amount</Text>
                                        <Text style={[
                                            styles.transactionDetailValue,
                                            styles.transactionDetailAmount,
                                            selectedTransactionDetail.type === 'credit' ? styles.positiveAmount : styles.negativeAmount
                                        ]}>
                                            {selectedTransactionDetail.type === 'credit' ? '+' : '-'}₹{selectedTransactionDetail.amount.toLocaleString()}
                                        </Text>
                                    </View>

                                    {/* Customer Name (if viewing from all transactions) */}
                                    {view === 'transactions' && (
                                        <View style={styles.transactionDetailRow}>
                                            <Text style={styles.transactionDetailLabel}>Customer</Text>
                                            <Text style={styles.transactionDetailValue}>
                                                {customers.find(c => c.id === selectedTransactionDetail.customerId)?.name || 'Unknown'}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Date */}
                                    <View style={styles.transactionDetailRow}>
                                        <Text style={styles.transactionDetailLabel}>Date</Text>
                                        <View style={styles.transactionDetailValueRow}>
                                            <Feather name="calendar" size={16} color="#6B7280" />
                                            <Text style={styles.transactionDetailValue}>
                                                {new Date(selectedTransactionDetail.transactionDate || selectedTransactionDetail.createdAt).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Time */}
                                    <View style={styles.transactionDetailRow}>
                                        <Text style={styles.transactionDetailLabel}>Time</Text>
                                        <View style={styles.transactionDetailValueRow}>
                                            <Feather name="clock" size={16} color="#6B7280" />
                                            <Text style={styles.transactionDetailValue}>
                                                {new Date(selectedTransactionDetail.transactionDate || selectedTransactionDetail.createdAt).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Description */}
                                    <View style={styles.transactionDetailRowColumn}>
                                        <Text style={styles.transactionDetailLabel}>Description</Text>
                                        <View style={styles.transactionDetailDescriptionBox}>
                                            <Text style={styles.transactionDetailDescriptionText}>
                                                {selectedTransactionDetail.description || (selectedTransactionDetail.type === 'credit' ? 'Payment Received' : 'Payment Given')}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={styles.transactionDetailActions}>
                                        <TouchableOpacity
                                            style={styles.transactionDetailEditButton}
                                            onPress={() => {
                                                setShowTransactionDetail(false);
                                                setEditingTransaction(selectedTransactionDetail);
                                                setShowEditTransaction(true);
                                            }}
                                        >
                                            <Feather name="edit-2" size={20} color="#fff" />
                                            <Text style={styles.transactionDetailEditButtonText}>Edit Transaction</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.transactionDetailDeleteButton}
                                            onPress={() => {
                                                setShowTransactionDetail(false);
                                                setSelectedTransactionDetail(null);
                                                deleteTransaction(selectedTransactionDetail.id);
                                            }}
                                        >
                                            <Feather name="trash-2" size={20} color="#fff" />
                                            <Text style={styles.transactionDetailDeleteButtonText}>Delete Transaction</Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function CustomerForm({ onSubmit, onCancel, initialData }) {
    const [name, setName] = useState(initialData?.name || '');
    const [phone, setPhone] = useState(initialData?.phone || '');

    const handleSubmit = () => {
        if (name.trim()) {
            Keyboard.dismiss();
            onSubmit({ name, phone });
            if (!initialData) {
                setName('');
                setPhone('');
            }
        }
    };

    return (
        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
                <Text style={styles.label}>Customer Name *</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter customer name"
                    value={name}
                    onChangeText={setName}
                    returnKeyType="next"
                    blurOnSubmit={false}
                />
            </View>
            <View style={styles.formGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter phone number"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                />
            </View>
            <View style={styles.formButtons}>
                <TouchableOpacity onPress={() => {
                    Keyboard.dismiss();
                    onCancel();
                }} style={[styles.button, styles.buttonSecondary]}>
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSubmit} style={[styles.button, styles.buttonPrimary]}>
                    <Text style={styles.buttonPrimaryText}>{initialData ? 'Update Customer' : 'Add Customer'}</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                onPress={Keyboard.dismiss}
                style={styles.dismissKeyboardButton}
            >
                <Feather name="chevron-down" size={20} color="#fff" />
                <Text style={styles.dismissKeyboardText}>Done</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

function TransactionForm({ onSubmit, onCancel, transactionDate, setTransactionDate, initialData }) {
    const [type, setType] = useState(initialData?.type || 'credit');
    const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleSubmit = () => {
        if (amount && parseFloat(amount) > 0) {
            Keyboard.dismiss();
            onSubmit({
                type,
                amount: parseFloat(amount),
                description,
                transactionDate: transactionDate.toISOString()
            });
            if (!initialData) {
                setAmount('');
                setDescription('');
                setTransactionDate(new Date());
            }
        }
    };

    const formatDate = (date) => {
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    };

    const isToday = (date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const changeDate = (days) => {
        const newDate = new Date(transactionDate);
        newDate.setDate(newDate.getDate() + days);
        setTransactionDate(newDate);
    };

    return (
        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
                <Text style={styles.label}>Transaction Date</Text>
                <View style={styles.datePickerContainer}>
                    <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrowButton}>
                        <Feather name="chevron-left" size={24} color="#3B82F6" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setShowDatePicker(!showDatePicker)}
                        style={styles.dateDisplay}
                    >
                        <Feather name="calendar" size={20} color="#3B82F6" />
                        <Text style={styles.dateDisplayText}>
                            {isToday(transactionDate) ? 'Today' : formatDate(transactionDate)}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateArrowButton}>
                        <Feather name="chevron-right" size={24} color="#3B82F6" />
                    </TouchableOpacity>
                </View>

                {showDatePicker && (
                    <View style={styles.quickDateOptions}>
                        <TouchableOpacity
                            onPress={() => {
                                setTransactionDate(new Date());
                                setShowDatePicker(false);
                            }}
                            style={styles.quickDateButton}
                        >
                            <Text style={styles.quickDateButtonText}>Today</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                const yesterday = new Date();
                                yesterday.setDate(yesterday.getDate() - 1);
                                setTransactionDate(yesterday);
                                setShowDatePicker(false);
                            }}
                            style={styles.quickDateButton}
                        >
                            <Text style={styles.quickDateButtonText}>Yesterday</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                const weekAgo = new Date();
                                weekAgo.setDate(weekAgo.getDate() - 7);
                                setTransactionDate(weekAgo);
                                setShowDatePicker(false);
                            }}
                            style={styles.quickDateButton}
                        >
                            <Text style={styles.quickDateButtonText}>7 Days Ago</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Transaction Type *</Text>
                <View style={styles.typeButtons}>
                    <TouchableOpacity
                        onPress={() => setType('credit')}
                        style={[styles.typeButton, type === 'credit' && styles.typeButtonCredit]}
                    >
                        <Text style={[styles.typeButtonText, type === 'credit' && styles.typeButtonTextActive]}>
                            Got
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setType('debit')}
                        style={[styles.typeButton, type === 'debit' && styles.typeButtonDebit]}
                    >
                        <Text style={[styles.typeButtonText, type === 'debit' && styles.typeButtonTextActive]}>
                            Given
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.formGroup}>
                <Text style={styles.label}>Amount *</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter amount"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                    blurOnSubmit={false}
                />
            </View>
            <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter description (optional)"
                    value={description}
                    onChangeText={setDescription}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                />
            </View>
            <View style={styles.formButtons}>
                <TouchableOpacity onPress={() => {
                    Keyboard.dismiss();
                    onCancel();
                }} style={[styles.button, styles.buttonSecondary]}>
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleSubmit}
                    style={[styles.button, type === 'credit' ? styles.creditButton : styles.debitButton]}
                >
                    <Text style={styles.buttonPrimaryText}>{initialData ? 'Update Transaction' : 'Add Transaction'}</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                onPress={Keyboard.dismiss}
                style={styles.dismissKeyboardButton}
            >
                <Feather name="chevron-down" size={20} color="#fff" />
                <Text style={styles.dismissKeyboardText}>Done</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

function CustomerReport({ customer, transactions, onClose }) {
    if (!customer) return null;

    const downloadReport = async () => {
        try {
            const reportText = generateReportText();
            await Share.share({
                message: reportText,
                title: `${customer.name} - Transaction Report`,
            });
        } catch (error) {
            console.error('Error sharing report:', error);
            Alert.alert('Error', 'Failed to share report');
        }
    };

    const generateReportText = () => {
        let text = `TRANSACTION REPORT\n`;
        text += `========================\n\n`;
        text += `Customer: ${customer.name}\n`;
        if (customer.phone) text += `Phone: ${customer.phone}\n`;
        text += `\n`;
        text += `Balance: ₹${Math.abs(balance).toLocaleString()}\n`;
        text += `Total Got: ₹${totalCredit.toLocaleString()}\n`;
        text += `Total Given: ₹${totalDebit.toLocaleString()}\n`;
        text += `\n========================\n\n`;

        Object.keys(groupedTransactions).forEach((monthYear) => {
            text += `${monthYear}\n`;
            text += `-------------------\n`;
            groupedTransactions[monthYear].forEach((txn) => {
                const txnDate = new Date(txn.transactionDate || txn.createdAt);
                text += `${txnDate.toLocaleDateString()} - `;
                text += `${txn.description || (txn.type === 'credit' ? 'Payment Received' : 'Payment Given')} - `;
                text += `₹${txn.amount.toLocaleString()}\n`;
            });
            text += `\n`;
        });

        text += `========================\n`;
        text += `Generated: ${new Date().toLocaleString()}\n`;

        return text;
    };

    const sortedTransactions = transactions.sort((a, b) => {
        const dateA = new Date(a.transactionDate || a.createdAt);
        const dateB = new Date(b.transactionDate || b.createdAt);
        return dateB - dateA;
    });

    const totalCredit = transactions.reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : 0), 0);
    const totalDebit = transactions.reduce((sum, t) => sum + (t.type === 'debit' ? t.amount : 0), 0);
    const balance = totalCredit - totalDebit;

    const oldestDate = sortedTransactions.length > 0
        ? new Date(sortedTransactions[sortedTransactions.length - 1].transactionDate || sortedTransactions[sortedTransactions.length - 1].createdAt)
        : new Date();
    const latestDate = sortedTransactions.length > 0
        ? new Date(sortedTransactions[0].transactionDate || sortedTransactions[0].createdAt)
        : new Date();

    const formatDate = (date) => {
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    };

    const getMonthYear = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('default', { month: 'short', year: 'numeric' });
    };

    const groupedTransactions = sortedTransactions.reduce((groups, txn) => {
        const monthYear = getMonthYear(txn.transactionDate || txn.createdAt);
        if (!groups[monthYear]) {
            groups[monthYear] = [];
        }
        groups[monthYear].push(txn);
        return groups;
    }, {});

    return (
        <ScrollView style={styles.reportContent}>
            <TouchableOpacity onPress={downloadReport} style={styles.downloadButton}>
                <Feather name="download" size={20} color="#fff" />
                <Text style={styles.downloadButtonText}>Download/Share Report</Text>
            </TouchableOpacity>

            <View style={styles.reportInfoCard}>
                <Text style={styles.reportBalance}>₹{Math.abs(balance).toLocaleString()}</Text>
                <Text style={styles.reportBalanceLabel}>
                    Balance | {formatDate(oldestDate)} - {formatDate(latestDate)}
                </Text>

                <View style={styles.reportSummary}>
                    <View style={styles.reportSummaryItem}>
                        <Text style={styles.reportSummaryLabel}>Got ({transactions.filter(t => t.type === 'credit').length})</Text>
                        <Text style={styles.reportSummaryCredit}>₹{totalCredit.toLocaleString()}</Text>
                    </View>
                    <View style={styles.reportSummaryDivider} />
                    <View style={styles.reportSummaryItem}>
                        <Text style={styles.reportSummaryLabel}>Given ({transactions.filter(t => t.type === 'debit').length})</Text>
                        <Text style={styles.reportSummaryDebit}>₹{totalDebit.toLocaleString()}</Text>
                    </View>
                </View>

                <View style={styles.reportCustomerInfo}>
                    <Text style={styles.reportCustomerName}>Customer: {customer.name}</Text>
                    {customer.phone && <Text style={styles.reportCustomerPhone}>{customer.phone}</Text>}
                    <Text style={styles.reportCreatedDate}>Created On: {formatDate(new Date())}</Text>
                </View>
            </View>

            {Object.keys(groupedTransactions).map((monthYear) => (
                <View key={monthYear} style={styles.reportMonthSection}>
                    <Text style={styles.reportMonthTitle}>{monthYear}</Text>
                    {groupedTransactions[monthYear].map((txn) => {
                        const txnDate = new Date(txn.transactionDate || txn.createdAt);
                        return (
                            <View key={txn.id} style={styles.reportTransactionItem}>
                                <View style={styles.reportTransactionLeft}>
                                    <Text style={styles.reportTransactionDay}>{txnDate.getDate()}</Text>
                                    <Text style={styles.reportTransactionMonth}>
                                        {txnDate.toLocaleString('default', { month: 'short' })}
                                    </Text>
                                </View>
                                <View style={styles.reportTransactionMiddle}>
                                    <Text style={styles.reportTransactionDescription}>
                                        {txn.description || (txn.type === 'credit' ? 'Payment Received' : 'Payment Given')}
                                    </Text>
                                </View>
                                <View style={styles.reportTransactionRight}>
                                    <Text style={[
                                        styles.reportTransactionAmount,
                                        txn.type === 'credit' ? styles.reportAmountCredit : styles.reportAmountDebit
                                    ]}>
                                        ₹{txn.amount.toLocaleString()}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            ))}

            {sortedTransactions.length === 0 && (
                <Text style={styles.emptyText}>No transactions found</Text>
            )}

            <View style={styles.reportFooter}>
                <Text style={styles.reportFooterText}>
                    Current Balance: ₹{Math.abs(balance).toLocaleString()} ({balance >= 0 ? 'Got' : 'Given'})
                </Text>
                <Text style={styles.reportFooterDate}>As of {formatDate(new Date())}</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F4F8',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F4F8',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6B7280',
    },
    authContainer: {
        flex: 1,
        backgroundColor: '#F0F4F8',
    },
    authContent: {
        flex: 1,
    },
    authScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    authHeader: {
        alignItems: 'center',
        marginBottom: 40,
    },
    authTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1F2937',
        marginTop: 16,
    },
    authSubtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 8,
    },
    authForm: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    authInputGroup: {
        marginBottom: 20,
    },
    authLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    authInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        backgroundColor: '#F9FAFB',
    },
    authButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    authButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    authSwitchButton: {
        marginTop: 16,
        alignItems: 'center',
    },
    authSwitchText: {
        color: '#3B82F6',
        fontSize: 14,
    },
    header: {
        backgroundColor: '#3B82F6',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
        paddingBottom: 15,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        flex: 1,
    },
    logoutButton: {
        padding: 4,
    },
    profileButton: {
        padding: 4,
    },
    tabBar: {
        flexDirection: 'row',
        gap: 8,
    },
    tab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    tabActive: {
        backgroundColor: '#fff',
    },
    tabText: {
        color: '#fff',
        fontSize: 14,
    },
    tabTextActive: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 16,
    },
    userInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    userEmail: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    summaryContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    summaryAmount: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    positiveAmount: {
        color: '#10B981',
    },
    negativeAmount: {
        color: '#EF4444',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 4,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 16,
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    listItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    listItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    listItemSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 4,
    },
    phoneContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    listItemRight: {
        alignItems: 'flex-end',
    },
    balanceAmount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    balanceLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    emptyText: {
        textAlign: 'center',
        color: '#9CA3AF',
        paddingVertical: 32,
        fontSize: 14,
    },
    customerDetailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    customerName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    customerPhone: {
        fontSize: 16,
        color: '#6B7280',
        marginLeft: 4,
    },
    balanceCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        marginBottom: 16,
    },
    balanceCardLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    balanceCardAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    balanceCardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    addCreditButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        gap: 8,
    },
    addCreditButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    reportButton: {
        flex: 0.6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        backgroundColor: '#fff',
        borderRadius: 8,
        gap: 8,
        borderWidth: 2,
        borderColor: '#3B82F6',
    },
    reportButtonText: {
        color: '#3B82F6',
        fontWeight: '600',
        fontSize: 16,
    },
    creditButton: {
        backgroundColor: '#10B981',
    },
    debitButton: {
        backgroundColor: '#EF4444',
    },
    filterContainer: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    filterButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    iconButton: {
        width: 36,
        height: 36,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    filterButtonText: {
        fontSize: 12,
        color: '#6B7280',
    },
    filterButtonTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    transactionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    transactionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    transactionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    creditIcon: {
        backgroundColor: '#D1FAE5',
    },
    debitIcon: {
        backgroundColor: '#FEE2E2',
    },
    transactionCustomer: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    transactionDescription: {
        fontSize: 14,
        color: '#1F2937',
        fontWeight: '500',
    },
    transactionDate: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    transactionDateText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    transactionRight: {
        alignItems: 'flex-end',
        gap: 4,
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    form: {
        padding: 16,
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    typeButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
    },
    typeButtonCredit: {
        borderColor: '#10B981',
        backgroundColor: '#D1FAE5',
    },
    typeButtonDebit: {
        borderColor: '#EF4444',
        backgroundColor: '#FEE2E2',
    },
    typeButtonText: {
        fontSize: 14,
        color: '#6B7280',
    },
    typeButtonTextActive: {
        fontWeight: '600',
    },
    formButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonPrimary: {
        backgroundColor: '#3B82F6',
    },
    buttonSecondary: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#fff',
    },
    buttonPrimaryText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    buttonSecondaryText: {
        color: '#6B7280',
        fontWeight: '600',
        fontSize: 16,
    },
    dismissKeyboardButton: {
        backgroundColor: '#3B82F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 8,
        gap: 8,
    },
    dismissKeyboardText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    datePickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    dateArrowButton: {
        padding: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    dateDisplay: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EFF6FF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    dateDisplayText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3B82F6',
    },
    quickDateOptions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    quickDateButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        alignItems: 'center',
    },
    quickDateButtonText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    reportContainer: {
        flex: 1,
        backgroundColor: '#F0F4F8',
    },
    reportHeader: {
        backgroundColor: '#3B82F6',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    reportCloseButton: {
        padding: 4,
    },
    reportHeaderTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    reportContent: {
        flex: 1,
        padding: 16,
    },
    reportInfoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    reportBalance: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#3B82F6',
        textAlign: 'center',
    },
    reportBalanceLabel: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 16,
    },
    reportSummary: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
    },
    reportSummaryItem: {
        alignItems: 'center',
    },
    reportSummaryLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    reportSummaryCredit: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#10B981',
    },
    reportSummaryDebit: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#EF4444',
    },
    reportSummaryDivider: {
        width: 1,
        backgroundColor: '#E5E7EB',
    },
    reportCustomerInfo: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderColor: '#E5E7EB',
    },
    reportCustomerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    reportCustomerPhone: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    reportCreatedDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    reportMonthSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    reportMonthTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3B82F6',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    reportTransactionItem: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    reportTransactionLeft: {
        width: 50,
        alignItems: 'center',
        marginRight: 12,
    },
    reportTransactionDay: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    reportTransactionMonth: {
        fontSize: 12,
        color: '#6B7280',
        textTransform: 'uppercase',
    },
    reportTransactionMiddle: {
        flex: 1,
        justifyContent: 'center',
    },
    reportTransactionDescription: {
        fontSize: 14,
        color: '#374151',
    },
    reportTransactionRight: {
        justifyContent: 'center',
        alignItems: 'flex-end',
        minWidth: 100,
    },
    reportTransactionAmount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    reportAmountCredit: {
        color: '#10B981',
    },
    reportAmountDebit: {
        color: '#EF4444',
    },
    reportFooter: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginTop: 8,
        marginBottom: 20,
        alignItems: 'center',
    },
    reportFooterText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 4,
    },
    reportFooterDate: {
        fontSize: 12,
        color: '#6B7280',
    },
    profileModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    profileModalBackdrop: {
        flex: 1,
    },
    profileModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
    },
    profileHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    profileHeaderTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    profileContent: {
        padding: 20,
    },
    profileAvatarContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    profileAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#3B82F6',
    },
    profileInfoSection: {
        marginBottom: 24,
    },
    profileInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 16,
    },
    profileInfoIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInfoText: {
        flex: 1,
    },
    profileInfoLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 4,
    },
    profileInfoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    logoutButtonLarge: {
        backgroundColor: '#EF4444',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    sortButton: {
        padding: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        marginRight: 8,
    },
    sortOptions: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 8,
        marginBottom: 12,
    },
    sortOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    sortOptionText: {
        fontSize: 14,
        color: '#374151',
    },
    dateSearchContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    dateSearchLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 8,
        fontWeight: '600',
    },
    dateSearchButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    dateSearchButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#3B82F6',
        borderRadius: 6,
        alignItems: 'center',
    },
    dateSearchButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    clearDateButton: {
        backgroundColor: '#EF4444',
    },
    clearDateButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    selectedDateText: {
        fontSize: 12,
        color: '#10B981',
        fontWeight: '500',
    },
    activeDateFilter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#EFF6FF',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        marginTop: 8,
    },
    customRangeButton: {
        backgroundColor: '#8B5CF6',
    },
    customDateRangeContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    customDateRangeTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 12,
    },
    dateRangePicker: {
        gap: 16,
        marginBottom: 16,
    },
    datePickerGroup: {
        gap: 8,
    },
    datePickerLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        gap: 10,
    },
    dateInputField: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        fontSize: 16,
        color: '#1F2937',
    },
    quickSelectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EFF6FF',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        gap: 6,
        marginTop: 4,
    },
    quickSelectText: {
        fontSize: 13,
        color: '#3B82F6',
        fontWeight: '500',
    },
    datePickerButtonText: {
        fontSize: 14,
        color: '#374151',
        flex: 1,
    },
    datePickerQuickOptions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    quickOptionButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        alignItems: 'center',
    },
    quickOptionText: {
        fontSize: 12,
        color: '#3B82F6',
        fontWeight: '500',
    },
    customDateRangeActions: {
        flexDirection: 'row',
        gap: 12,
    },
    transactionActions: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    recycleBinButton: {
        backgroundColor: '#6B7280',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        marginBottom: 16,
    },
    recycleBinButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    deletedItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    deletedItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    deletedItemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    restoreButton: {
        padding: 8,
        backgroundColor: '#D1FAE5',
        borderRadius: 8,
    },
    deletedItemInfo: {
        flex: 1,
    },
    deletedItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    deletedItemDate: {
        fontSize: 13,
        color: '#6B7280',
    },
    downloadButton: {
        backgroundColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    downloadButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    profileVersionText: {
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 16,
    },
    editIconButton: {
        marginTop: 4,
        padding: 4,
    },
    transactionTextContainer: {
        flex: 1,
        paddingRight: 8,
    },
    transactionDetailContent: {
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    transactionDetailBadge: {
        alignItems: 'center',
        marginBottom: 24,
    },
    transactionTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        gap: 8,
    },
    creditBadge: {
        backgroundColor: '#D1FAE5',
    },
    debitBadge: {
        backgroundColor: '#FEE2E2',
    },
    transactionTypeBadgeText: {
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    creditText: {
        color: '#10B981',
    },
    debitText: {
        color: '#EF4444',
    },
    transactionDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    transactionDetailRowColumn: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    transactionDetailLabel: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
        marginBottom: 4,
    },
    transactionDetailValue: {
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '600',
        marginLeft: 4,
    },
    transactionDetailAmount: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    transactionDetailValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    transactionDetailDescriptionBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
    },
    transactionDetailDescriptionText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    transactionDetailActions: {
        marginTop: 24,
        gap: 12,
    },
    transactionDetailEditButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 14,
        borderRadius: 8,
        gap: 8,
    },
    transactionDetailEditButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    transactionDetailDeleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        paddingVertical: 14,
        borderRadius: 8,
        gap: 8,
    },
    transactionDetailDeleteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});