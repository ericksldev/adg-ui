import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { CorralWorkSessionRoutingModule } from './corral-work-session-routing.module';
import { CorralWorkSessionListComponent } from './pages/corral-work-session-list/corral-work-session-list.component';
import { CorralWorkSessionCreateComponent } from './pages/corral-work-session-create/corral-work-session-create.component';
import { CorralWorkSessionSetupComponent } from './pages/corral-work-session-setup/corral-work-session-setup.component';
import { CorralWorkSessionLoadAnimalsComponent } from './pages/corral-work-session-load-animals/corral-work-session-load-animals.component';
import { CorralWorkSessionWorkspaceComponent } from './pages/corral-work-session-workspace/corral-work-session-workspace.component';
import { CorralWorkSessionDetailComponent } from './pages/corral-work-session-detail/corral-work-session-detail.component';
import { CorralStepGridComponent } from './components/corral-step-grid/corral-step-grid.component';
import { CorralActivityShortcutPageComponent } from './pages/corral-activity-shortcut/corral-activity-shortcut-page.component';

@NgModule({
  declarations: [
    CorralWorkSessionListComponent,
    CorralWorkSessionCreateComponent,
    CorralWorkSessionSetupComponent,
    CorralWorkSessionLoadAnimalsComponent,
    CorralWorkSessionWorkspaceComponent,
    CorralWorkSessionDetailComponent,
    CorralActivityShortcutPageComponent,
    CorralStepGridComponent
  ],
  imports: [CommonModule, FormsModule, SharedModule, CorralWorkSessionRoutingModule]
})
export class CorralWorkSessionModule {}
