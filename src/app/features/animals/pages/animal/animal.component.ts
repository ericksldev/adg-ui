import { Component, OnInit } from '@angular/core';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { AnimalListItem } from '../../models/animal.model';
import { AnimalService } from '../../services/animal.service';

@Component({
  selector: 'app-animal',
  templateUrl: './animal.component.html',
  styleUrls: ['./animal.component.scss']
})
export class AnimalComponent implements OnInit {
  animals: AnimalListItem[] = [];
  searchTerm = '';
  selectedSex = 'ALL';
  page = 1;
  readonly pageSize = 10;

  constructor(
    private readonly animalService: AnimalService,
    private readonly sessionService: SessionService
  ) {}

  get canAnimalWrite(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.ANIMAL_WRITE);
  }

  ngOnInit(): void {
    this.animalService.getAnimals().subscribe({
      next: (animals) => {
        this.animals = animals;
      },
      error: () => {
        this.animals = [];
      }
    });
  }

  get filteredAnimals(): AnimalListItem[] {
    const normalizedSearch = this.searchTerm.trim().toLowerCase();
    return this.animals.filter((animal) => {
      const matchesSex = this.selectedSex === 'ALL' || animal.sex === this.selectedSex;
      const reg = animal.registration_number?.toLowerCase() ?? '';
      const chip = animal.chip_number?.toLowerCase() ?? '';
      const matchesSearch =
        normalizedSearch.length === 0 ||
        reg.includes(normalizedSearch) ||
        chip.includes(normalizedSearch) ||
        (animal.breed_code?.toLowerCase().includes(normalizedSearch) ?? false) ||
        (animal.color?.toLowerCase().includes(normalizedSearch) ?? false) ||
        (animal.description?.toLowerCase().includes(normalizedSearch) ?? false);
      return matchesSex && matchesSearch;
    });
  }

  get paginatedAnimals(): AnimalListItem[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredAnimals.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    const pages = Math.ceil(this.filteredAnimals.length / this.pageSize);
    return pages > 0 ? pages : 1;
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  updateSearch(term: string): void {
    this.searchTerm = term;
    this.page = 1;
  }

  updateSexFilter(value: string): void {
    this.selectedSex = value;
    this.page = 1;
  }

  goToPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.page = nextPage;
  }
}
