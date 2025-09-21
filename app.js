class ProfileApp {
    constructor() {
        this.jwt = null;
        this.userData = null;
        this.apiUrl = 'https://learn.zone01kisumu.ke/api/graphql-engine/v1/graphql';
        this.signinUrl = 'https://learn.zone01kisumu.ke/api/auth/signin';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
    }

    bindEvents() {
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    checkAuth() {
        this.jwt = sessionStorage.getItem('jwt');
        if (this.jwt && this.jwt.trim()) {
            this.showProfile();
        } else {
            this.showLogin();
        }
    }

    showLogin() {
        document.getElementById('login-page').classList.remove('hidden');
        document.getElementById('profile-page').classList.add('hidden');
    }

    showProfile() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('profile-page').classList.remove('hidden');
        this.loadProfileData();
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const identifier = document.getElementById('identifier').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('login-error');
        
        try {
            const credentials = btoa(`${identifier}:${password}`);
            const response = await fetch(this.signinUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const responseText = await response.text();
                // Remove quotes if present and clean the token
                this.jwt = responseText.replace(/^"|"$/g, '').trim();
                sessionStorage.setItem('jwt', this.jwt);
                errorDiv.textContent = '';
                this.showProfile();
            } else {
                const errorText = await response.text();
                errorDiv.textContent = 'Invalid credentials. Please try again.';
                console.error('Login failed:', response.status, errorText);
            }
        } catch (error) {
            errorDiv.textContent = 'Login failed. Please check your connection.';
            console.error('Login error:', error);
        }
    }

    logout() {
        this.jwt = null;
        this.userData = null;
        sessionStorage.removeItem('jwt');
        this.showLogin();
    }

    async graphqlQuery(query, variables = {}) {
        try {
            console.log('Making GraphQL request with JWT:', this.jwt ? 'Present' : 'Missing');
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.jwt}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, variables })
            });

            console.log('GraphQL response status:', response.status);

            if (response.status === 401) {
                console.error('JWT token expired or invalid');
                this.logout();
                return null;
            }

            const result = await response.json();
            if (result.errors) {
                console.error('GraphQL errors:', result.errors);
                this.showError('GraphQL query failed: ' + result.errors[0].message);
            }
            return result.data;
        } catch (error) {
            console.error('GraphQL request failed:', error);
            this.showError('Network error: Failed to connect to GraphQL API');
            return null;
        }
    }

    async loadProfileData() {
        this.showLoading(true);

        try {
            // Fetch user data
            const userData = await this.fetchUserData();
            if (!userData) return;

            // Fetch transaction data for XP calculations
            const transactionData = await this.fetchTransactionData();
            
            // Fetch result data for pass/fail ratio
            const resultData = await this.fetchResultData();
            
            // Fetch object data for better labeling
            const objectData = await this.fetchObjectData();
            
            // Fetch event data for XP classification
            const eventData = await this.fetchEventData();

            // Update UI
            this.updateUserInfo(userData);
            this.updateStats(transactionData, resultData);
            this.renderCharts(transactionData, resultData, objectData, eventData);

        } catch (error) {
            this.showError('Failed to load profile data');
        } finally {
            this.showLoading(false);
        }
    }

    async fetchUserData() {
        const query = `
            query {
                user {
                    id
                    login
                }
            }
        `;
        
        const data = await this.graphqlQuery(query);
        return data?.user?.[0];
    }

    async fetchTransactionData() {
        const query = `
            query {
                transaction {
                    type
                    amount
                    createdAt
                    path
                    objectId
                    eventId
                }
            }
        `;
        
        const data = await this.graphqlQuery(query);
        return data?.transaction || [];
    }

    async fetchResultData() {
        const query = `
            query {
                result {
                    grade
                    objectId
                    type
                }
            }
        `;
        
        const data = await this.graphqlQuery(query);
        return data?.result || [];
    }

    async fetchObjectData() {
        const query = `
            query {
                object {
                    id
                    name
                    type
                }
            }
        `;
        
        const data = await this.graphqlQuery(query);
        return data?.object || [];
    }

    async fetchEventData() {
        const query = `
            query {
                event {
                    id
                    path
                    objectId
                }
            }
        `;
        
        const data = await this.graphqlQuery(query);
        return data?.event || [];
    }

    updateUserInfo(userData) {
        if (userData) {
            document.getElementById('user-login').textContent = userData.login || `User ${userData.id}`;
            document.getElementById('user-id').textContent = `ID: ${userData.id}`;
        }
    }

    formatXP(bytes) {
        if (bytes >= 1000000) {
            return `${(bytes / 1000000).toFixed(1)} MB`;
        } else if (bytes >= 1000) {
            return `${(bytes / 1000).toFixed(1)} kB`;
        }
        return `${bytes} B`;
    }

    updateStats(transactions, results) {
        // Calculate total XP (only XP type transactions)
        const xpTransactions = transactions.filter(t => t.type === 'xp');
        const totalXP = xpTransactions.reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('total-xp').textContent = this.formatXP(totalXP);

        // Calculate projects completed (unique objectIds with XP > 0)
        const completedProjects = new Set(
            xpTransactions
                .filter(t => t.amount > 0 && t.objectId)
                .map(t => t.objectId)
        ).size;
        document.getElementById('projects-completed').textContent = completedProjects;

        // Calculate success rate (grade >= 1 means pass, only tester and user_audit results)
        const validResults = results.filter(r => r.type === 'tester' || r.type === 'user_audit');
        const passCount = validResults.filter(r => r.grade >= 1).length;
        const totalAttempts = validResults.length;
        const successRate = totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0;
        document.getElementById('success-rate').textContent = `${successRate}%`;

        // Show XP breakdown by events in console for debugging
        const xpByEvent = {};
        xpTransactions.forEach(t => {
            if (t.eventId) {
                xpByEvent[t.eventId] = (xpByEvent[t.eventId] || 0) + t.amount;
            }
        });
        console.log('XP by Event:', xpByEvent);
    }

    renderCharts(transactions, results, objects = [], events = []) {
        this.renderXPChart(transactions, events);
        this.renderRatioChart(results);
        this.renderEventXPChart(transactions, events);
    }

    renderXPChart(transactions, events = []) {
        const svg = document.getElementById('xp-chart');
        svg.innerHTML = '';

        // Filter only XP transactions
        const xpTransactions = transactions.filter(t => t.type === 'xp');
        
        if (xpTransactions.length === 0) {
            this.showEmptyChart(svg, 'No XP data available');
            return;
        }

        // Create event lookup for better labeling
        const eventMap = {};
        events.forEach(e => {
            eventMap[e.id] = e.path || `Event ${e.id}`;
        });

        // Group transactions by date
        const dailyXP = {};
        xpTransactions.forEach(t => {
            const date = new Date(t.createdAt).toDateString();
            dailyXP[date] = (dailyXP[date] || 0) + t.amount;
        });

        const dates = Object.keys(dailyXP).sort();
        const values = dates.map(date => dailyXP[date]);

        // Calculate cumulative XP
        let cumulative = 0;
        const cumulativeValues = values.map(val => cumulative += val);

        // Chart dimensions
        const width = 600;
        const height = 300;
        const margin = { top: 20, right: 30, bottom: 40, left: 60 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Scales
        const maxXP = Math.max(...cumulativeValues);
        const xScale = (i) => margin.left + (i / (dates.length - 1)) * chartWidth;
        const yScale = (val) => margin.top + chartHeight - (val / maxXP) * chartHeight;

        // Create path for line chart
        let pathData = `M ${xScale(0)} ${yScale(cumulativeValues[0])}`;
        for (let i = 1; i < cumulativeValues.length; i++) {
            pathData += ` L ${xScale(i)} ${yScale(cumulativeValues[i])}`;
        }

        // Add axes
        this.addAxis(svg, margin.left, margin.top + chartHeight, margin.left + chartWidth, margin.top + chartHeight);
        this.addAxis(svg, margin.left, margin.top, margin.left, margin.top + chartHeight);

        // Add line path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('class', 'line-path');
        svg.appendChild(path);
    }

    renderRatioChart(results) {
        const svg = document.getElementById('ratio-chart');
        svg.innerHTML = '';

        if (results.length === 0) {
            this.showEmptyChart(svg, 'No result data available');
            return;
        }

        const passCount = results.filter(r => r.grade >= 1).length;
        const failCount = results.length - passCount;

        const width = 400;
        const height = 300;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 80;

        // Calculate angles
        const total = passCount + failCount;
        const passAngle = (passCount / total) * 2 * Math.PI;
        const failAngle = (failCount / total) * 2 * Math.PI;

        // Create pie slices
        if (passCount > 0) {
            const passPath = this.createPieSlice(centerX, centerY, radius, 0, passAngle);
            const passSlice = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            passSlice.setAttribute('d', passPath);
            passSlice.setAttribute('fill', '#27ae60');
            passSlice.setAttribute('class', 'pie-slice');
            
            passSlice.addEventListener('mouseenter', (e) => {
                this.showTooltip(e, `Pass: ${passCount} (${Math.round(passCount/total*100)}%)`);
            });
            passSlice.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
            
            svg.appendChild(passSlice);
        }

        if (failCount > 0) {
            const failPath = this.createPieSlice(centerX, centerY, radius, passAngle, passAngle + failAngle);
            const failSlice = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            failSlice.setAttribute('d', failPath);
            failSlice.setAttribute('fill', '#e74c3c');
            failSlice.setAttribute('class', 'pie-slice');
            
            failSlice.addEventListener('mouseenter', (e) => {
                this.showTooltip(e, `Fail: ${failCount} (${Math.round(failCount/total*100)}%)`);
            });
            failSlice.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
            
            svg.appendChild(failSlice);
        }

        // Add legend
        this.addLegend(svg, [
            { color: '#27ae60', label: 'Pass', count: passCount },
            { color: '#e74c3c', label: 'Fail', count: failCount }
        ]);
    }

    createPieSlice(centerX, centerY, radius, startAngle, endAngle) {
        const x1 = centerX + radius * Math.cos(startAngle);
        const y1 = centerY + radius * Math.sin(startAngle);
        const x2 = centerX + radius * Math.cos(endAngle);
        const y2 = centerY + radius * Math.sin(endAngle);
        
        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
        
        return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }

    addAxis(svg, x1, y1, x2, y2) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('class', 'axis-line');
        svg.appendChild(line);
    }

    addLegend(svg, items) {
        items.forEach((item, i) => {
            const y = 250 + i * 25;
            
            // Color box
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', 50);
            rect.setAttribute('y', y);
            rect.setAttribute('width', 15);
            rect.setAttribute('height', 15);
            rect.setAttribute('fill', item.color);
            svg.appendChild(rect);
            
            // Label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', 75);
            text.setAttribute('y', y + 12);
            text.setAttribute('class', 'axis-text');
            text.textContent = `${item.label}: ${item.count}`;
            svg.appendChild(text);
        });
    }

    showEmptyChart(svg, message) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '50%');
        text.setAttribute('y', '50%');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', '#999');
        text.textContent = message;
        svg.appendChild(text);
    }

    showTooltip(event, text) {
        let tooltip = document.querySelector('.tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            document.body.appendChild(tooltip);
        }
        
        tooltip.textContent = text;
        tooltip.style.display = 'block';
        tooltip.style.left = event.pageX + 10 + 'px';
        tooltip.style.top = event.pageY - 10 + 'px';
    }

    hideTooltip() {
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }

    renderEventXPChart(transactions, events = []) {
        const svg = document.getElementById('event-chart');
        svg.innerHTML = '';

        const xpTransactions = transactions.filter(t => t.type === 'xp');
        
        if (xpTransactions.length === 0) {
            this.showEmptyChart(svg, 'No XP data available');
            return;
        }

        // Group XP by event
        const xpByEvent = {};
        const eventMap = {};
        
        events.forEach(e => {
            eventMap[e.id] = e.path || `Event ${e.id}`;
        });
        
        xpTransactions.forEach(t => {
            if (t.eventId) {
                xpByEvent[t.eventId] = (xpByEvent[t.eventId] || 0) + t.amount;
            }
        });

        const eventIds = Object.keys(xpByEvent);
        if (eventIds.length === 0) {
            this.showEmptyChart(svg, 'No event XP data available');
            return;
        }

        const values = eventIds.map(id => xpByEvent[id]);
        const maxXP = Math.max(...values);

        // Chart dimensions
        const width = 500;
        const height = 300;
        const margin = { top: 20, right: 30, bottom: 60, left: 60 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        // Add axes
        this.addAxis(svg, margin.left, margin.top + chartHeight, margin.left + chartWidth, margin.top + chartHeight);
        this.addAxis(svg, margin.left, margin.top, margin.left, margin.top + chartHeight);

        // Draw bars
        const barWidth = chartWidth / eventIds.length * 0.8;
        const barSpacing = chartWidth / eventIds.length;

        eventIds.forEach((eventId, i) => {
            const value = xpByEvent[eventId];
            const barHeight = (value / maxXP) * chartHeight;
            const x = margin.left + i * barSpacing + (barSpacing - barWidth) / 2;
            const y = margin.top + chartHeight - barHeight;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', barWidth);
            rect.setAttribute('height', barHeight);
            rect.setAttribute('fill', '#667eea');
            rect.setAttribute('class', 'bar');

            rect.addEventListener('mouseenter', (e) => {
                const eventName = eventMap[eventId] || `Event ${eventId}`;
                this.showTooltip(e, `${eventName}: ${this.formatXP(value)}`);
            });
            rect.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });

            svg.appendChild(rect);

            // Add event label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x + barWidth / 2);
            text.setAttribute('y', margin.top + chartHeight + 15);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('class', 'axis-text');
            text.setAttribute('transform', `rotate(-45, ${x + barWidth / 2}, ${margin.top + chartHeight + 15})`);
            const eventName = (eventMap[eventId] || `Event ${eventId}`).split('/').pop() || 'Unknown';
            text.textContent = eventName.length > 10 ? eventName.substring(0, 10) + '...' : eventName;
            svg.appendChild(text);
        });
    }

    showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => errorDiv.classList.add('hidden'), 5000);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new ProfileApp();
});