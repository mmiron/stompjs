
import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { localeResolve } from './core/resolvers/locale.resolve';

export const routes: Routes = [
	{
		path: '',
		component: HomeComponent,
		resolve: { locale: localeResolve },
	},
	{
		path: 'table',
		loadComponent: () => import('./features/table/table.component').then(m => m.TableComponent),
		resolve: { locale: localeResolve },
	},
	{
		path: 'pdf-extract',
		loadComponent: () => import('./features/pdf-extract/pdf-extract.component').then(m => m.PdfExtractComponent),
		resolve: { locale: localeResolve },
	},
	{
		path: 'qr-extract',
		loadComponent: () => import('./features/qr-extract/qr-extract.component').then(m => m.QrExtractComponent),
		resolve: { locale: localeResolve },
	},
	{
		path: 'performance-dashboard',
		loadComponent: () => import('./features/performance-dashboard/performance-dashboard.component').then(m => m.PerformanceDashboardComponent),
		resolve: { locale: localeResolve },
	},
];
