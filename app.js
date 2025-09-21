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
        if (this.jwt) {
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
                this.jwt = await response.text();
                sessionStorage.setItem('jwt', this.jwt);
                errorDiv.textContent = '';
                this.showProfile();
            } else {
                errorDiv.textContent = 'Invalid credentials. Please try again.';
            }
        } catch (error) {
            errorDiv.textContent = 'Login failed. Please check your connection.';
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
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.jwt}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, variables })
            });

            if (response.status === 401) {
                this.logout();
                return null;
            }

            const result = await response.json();
            if (result.errors) {
                console.error('GraphQL errors:', result.errors);
            }
            return result.data;
        } catch (error) {
            console.error('GraphQL request failed:', error);
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

            // Update UI
            this.updateUserInfo(userData);
            this.updateStats(transactionData, resultData);
            this.renderCharts(transactionData, resultData);

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
                transaction(where: {type: {_eq: "xp"}}) {
                    amount
                    createdAt
                    path
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
                }
            }
        `;
        
        const data = await this.graphqlQuery(query);
        return data?.result || [];
    }

    updateUserInfo(userData) {
        if (userData) {
            document.getElementById('user-login').textContent = userData.login;
            document.getElementById('user-id').textContent = `ID: ${userData.id}`;
        }
    }

    updateStats(transactions, results) {
        // Calculate total XP
        const totalXP = transactions.reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('total-xp').textContent = totalXP.toLocaleString();

        // Calculate projects completed (unique paths with XP)
        const uniqueProjects = new Set(transactions.map(t => t.path)).size;
        document.getElementById('projects-completed').textContent = uniqueProjects;

        // Calculate success rate
        const passCount = results.filter(r => r.grade >= 1).length;
        const totalAttempts = results.length;
        const successRate = totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0;
        document.getElementById('success-rate').textContent = `${successRate}%`;
    }

    renderCharts(transactions, results) {
        this.renderXPChart(transactions);
        this.renderRatioChart(results);
    }

    renderXPChart(transactions) {
        const svg = document.getElementById('xp-chart');
        svg.innerHTML = '';

        if (transactions.length === 0) {
            this.showEmptyChart(svg, 'No XP data available');
            return;
        }

        // Group transactions by date
        const dailyXP = {};
        transactions.forEach(t => {
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

        // Add data points
        cumulativeValues.forEach((val, i) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', xScale(i));
            circle.setAttribute('cy', yScale(val));
            circle.setAttribute('r', 4);
            circle.setAttribute('fill', '#667eea');
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', 2);
            
            // Add tooltip
            circle.addEventListener('mouseenter', (e) => {
                this.showTooltip(e, `${dates[i]}: ${val.toLocaleString()} XP`);
            });
            circle.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
            
            svg.appendChild(circle);
        });
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